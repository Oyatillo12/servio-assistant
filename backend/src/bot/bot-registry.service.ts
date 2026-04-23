import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import TelegramBot from 'node-telegram-bot-api';

import { ClientService } from '../client/client.service.js';
import type { Client } from '../client/entities/client.entity.js';
import { BotService } from './bot.service.js';
import { validateBotToken } from './telegram-token-validator.js';

/**
 * Identifies which client (if any) a bot instance is bound to.
 * General bot has clientId = null; per-client bots have clientId set.
 */
export interface BotBinding {
  clientId: number | null;
}

const GENERAL: unique symbol = Symbol('general-bot');
type RegistryKey = number | typeof GENERAL;

/** Path suffix Telegram POSTs updates to, appended to PUBLIC_URL. */
const WEBHOOK_BASE_PATH = '/api/telegram/webhook';

/**
 * Deterministic per-bot secret that we hand Telegram in `setWebHook`.
 * Telegram echoes it back in the `X-Telegram-Bot-Api-Secret-Token` header
 * so the webhook controller can verify the sender. Derived from the token
 * so we don't need a new DB column; rotating the bot token rotates the secret.
 */
function webhookSecret(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

@Injectable()
export class BotRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotRegistry.name);
  private readonly bots = new Map<RegistryKey, TelegramBot>();
  /** Per-bot webhook secret, looked up by the controller on incoming POSTs. */
  private readonly secrets = new Map<RegistryKey, string>();
  private publicUrl: string | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    const raw = this.config.get<string>('PUBLIC_URL')?.trim();
    this.publicUrl = raw ? raw.replace(/\/$/, '') : null;

    if (this.publicUrl) {
      this.logger.log(`Webhook mode enabled (PUBLIC_URL=${this.publicUrl})`);
    } else {
      this.logger.log('Polling mode (set PUBLIC_URL to enable webhook mode)');
    }

    // 1. General bot from env (required)
    const generalToken = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    await this.startBot(GENERAL, generalToken, { clientId: null });
    this.logger.log('General Telegram bot started');

    // 2. Per-client dedicated bots from DB
    const clients = await this.clientService.findAll();
    for (const client of clients) {
      if (client.isActive && client.botToken) {
        try {
          await this.registerClientBot(client);
        } catch (err) {
          this.logger.error(
            `Failed to start dedicated bot for client #${client.id} "${client.name}": ${(err as Error).message}`,
          );
        }
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [key, bot] of this.bots.entries()) {
      await this.stopBot(key, bot);
    }
    this.bots.clear();
    this.secrets.clear();
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Return the bot instance that should be used to send outbound messages
   * to a given client's users (e.g. admin notifications, flow messages).
   * Falls back to the general bot when the client has no dedicated bot.
   */
  getBotForClient(clientId: number): TelegramBot {
    const own = this.bots.get(clientId);
    if (own) return own;
    const general = this.bots.get(GENERAL);
    if (!general) throw new Error('General bot not initialized');
    return general;
  }

  hasDedicatedBot(clientId: number): boolean {
    return this.bots.has(clientId);
  }

  /**
   * Feed an incoming Telegram update to the right bot. Called by the webhook
   * controller. `key` is `'general'` or the clientId; `secret` is the value of
   * the `X-Telegram-Bot-Api-Secret-Token` header — it MUST match what we
   * registered with Telegram or the update is silently dropped.
   */
  processUpdate(key: 'general' | number, body: unknown, secret: string): boolean {
    const mapKey: RegistryKey = key === 'general' ? GENERAL : key;
    const expected = this.secrets.get(mapKey);
    const bot = this.bots.get(mapKey);
    if (!expected || !bot) return false;
    if (!timingSafeEqual(secret, expected)) {
      this.logger.warn(`Rejected webhook update for ${String(key)} — bad secret`);
      return false;
    }
    bot.processUpdate(body as TelegramBot.Update);
    return true;
  }

  /**
   * Reconcile a client's bot state after a token change.
   *   token set + different → validate, (re)start dedicated bot
   *   token cleared         → stop and drop the dedicated bot
   */
  async reconcileClient(client: Client): Promise<void> {
    const existing = this.bots.get(client.id);

    if (!client.botToken || !client.isActive) {
      if (existing) await this.stopClientBot(client.id);
      return;
    }

    if (existing) {
      // Token might have changed; safest path is full restart.
      await this.stopClientBot(client.id);
    }

    await this.registerClientBot(client);
  }

  async unregisterClient(clientId: number): Promise<void> {
    await this.stopClientBot(clientId);
  }

  // ── Internals ────────────────────────────────────────────

  private async registerClientBot(client: Client): Promise<void> {
    if (!client.botToken) return;
    const identity = await validateBotToken(client.botToken);

    await this.startBot(client.id, client.botToken, { clientId: client.id });

    this.logger.log(
      `Dedicated bot started for client #${client.id} "${client.name}" → @${identity.username}`,
    );
  }

  private async stopClientBot(clientId: number): Promise<void> {
    const bot = this.bots.get(clientId);
    if (!bot) return;
    await this.stopBot(clientId, bot);
    this.bots.delete(clientId);
    this.secrets.delete(clientId);
    this.logger.log(`Dedicated bot stopped for client #${clientId}`);
  }

  /**
   * Create a bot instance in either webhook or polling mode based on
   * whether PUBLIC_URL is set, then register message handlers.
   */
  private async startBot(
    key: RegistryKey,
    token: string,
    binding: BotBinding,
  ): Promise<void> {
    const useWebhook = this.publicUrl !== null;

    const bot = new TelegramBot(token, useWebhook ? {} : { polling: true });
    this.botService.registerHandlers(bot, binding);
    this.bots.set(key, bot);

    if (useWebhook) {
      const secret = webhookSecret(token);
      this.secrets.set(key, secret);
      const path = this.pathFor(key);
      try {
        await bot.setWebHook(`${this.publicUrl}${path}`, {
          secret_token: secret,
        });
      } catch (err) {
        this.logger.error(
          `setWebHook failed for ${this.keyName(key)}: ${(err as Error).message}`,
        );
        throw err;
      }
    }
  }

  private async stopBot(key: RegistryKey, bot: TelegramBot): Promise<void> {
    try {
      if (this.publicUrl) {
        await bot.deleteWebHook();
      } else {
        await bot.stopPolling();
      }
    } catch {
      // best effort — we're shutting down anyway
    }
    this.logger.log(`Stopped bot ${this.keyName(key)}`);
  }

  private pathFor(key: RegistryKey): string {
    return key === GENERAL
      ? `${WEBHOOK_BASE_PATH}/general`
      : `${WEBHOOK_BASE_PATH}/client/${String(key)}`;
  }

  private keyName(key: RegistryKey): string {
    return key === GENERAL ? 'general' : `client#${String(key)}`;
  }
}

/** Constant-time string compare to avoid leaking the secret via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { GENERAL };
