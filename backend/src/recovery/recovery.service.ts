import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiService } from '../ai/ai.service.js';
import { BotRegistry } from '../bot/bot-registry.service.js';
import { ChatService } from '../chat/chat.service.js';
import { ChatSession } from '../chat/entities/chat-session.entity.js';
import { LeadStatus } from '../chat/entities/lead-status.enum.js';
import { ClientService } from '../client/client.service.js';
import type { Client } from '../client/entities/client.entity.js';
import type { Lang } from '../i18n/i18n.service.js';

/** How stale a conversation must be before we consider it abandoned. */
const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
/** Safety cap — never touch more than this many sessions in one run. */
const BATCH_LIMIT = 100;

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  /** Reentrancy guard — drops a tick if the previous run is still in flight. */
  private running = false;

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessions: Repository<ChatSession>,
    private readonly chat: ChatService,
    private readonly ai: AiService,
    private readonly clients: ClientService,
    private readonly registry: BotRegistry,
  ) {}

  /**
   * Every 30 minutes, look for sessions that:
   *  - have been silent for more than 2 hours,
   *  - are not already closed,
   *  - have never received a recovery message yet,
   *  - haven't produced a Lead or Order with a phone number yet.
   *
   * Send a single AI-generated "gentle follow-up" on each matching session.
   */
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'abandoned-lead-recovery' })
  async sendAbandonedRecoveries(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous recovery tick still running — skipping');
      return;
    }
    this.running = true;
    const started = Date.now();

    try {
      const candidates = await this.findAbandonedSessions();
      if (candidates.length === 0) {
        this.logger.debug('No abandoned sessions to recover');
        return;
      }

      this.logger.log(`Recovering ${candidates.length} abandoned session(s)`);
      let sent = 0;
      let failed = 0;

      for (const session of candidates) {
        const ok = await this.recoverOne(session);

        ok ? sent++ : failed++;
      }

      this.logger.log(
        `Recovery tick done — sent=${sent} failed=${failed} in ${Date.now() - started}ms`,
      );
    } catch (err) {
      this.logger.error(
        `Recovery tick crashed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.running = false;
    }
  }

  // ── Query ────────────────────────────────────────────────

  /**
   * Single SQL query — two NOT EXISTS subqueries cover the "no phone captured
   * yet" rule by checking the `leads` and `orders` tables (both record the
   * phone number when a user completes either flow).
   */
  private async findAbandonedSessions(): Promise<ChatSession[]> {
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);

    return this.sessions
      .createQueryBuilder('s')
      .where('s.lastMessageAt < :cutoff', { cutoff })
      .andWhere('s.leadStatus != :closed', { closed: LeadStatus.CLOSED })
      .andWhere('s.recoverySentAt IS NULL')
      .andWhere(
        `NOT EXISTS (
           SELECT 1 FROM leads l
           WHERE l."chatId" = s."chatId"
             AND l.phone IS NOT NULL
             AND l.phone <> ''
         )`,
      )
      .andWhere(
        `NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o."chatId" = s."chatId"
             AND o.phone IS NOT NULL
             AND o.phone <> ''
         )`,
      )
      .orderBy('s.lastMessageAt', 'ASC')
      .limit(BATCH_LIMIT)
      .getMany();
  }

  // ── Per-session pipeline ─────────────────────────────────

  private async recoverOne(session: ChatSession): Promise<boolean> {
    const { chatId, clientId } = session;

    // Claim the session first with an atomic UPDATE — if any concurrent
    // worker already marked it, affected=0 and we skip. This is the only
    // guarantee that a user never gets two recovery messages.
    const claim = await this.sessions
      .createQueryBuilder()
      .update(ChatSession)
      .set({ recoverySentAt: () => 'NOW()' })
      .where('chatId = :chatId', { chatId })
      .andWhere('recoverySentAt IS NULL')
      .execute();

    if (!claim.affected) {
      this.logger.debug(
        `Skipping chat ${chatId} — already claimed by another worker`,
      );
      return false;
    }

    let client: Client;
    try {
      client = await this.clients.findOne(clientId);
    } catch (err) {
      this.logger.warn(
        `Recovery: client #${clientId} not found for chat ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }

    if (!client.isActive) {
      this.logger.debug(
        `Skipping chat ${chatId} — client #${clientId} is inactive`,
      );
      return false;
    }

    const lang = this.resolveLang(session.lang, client.defaultLang);
    let message: string;
    try {
      message = await this.composeFollowUp(session, client, lang);
    } catch (err) {
      this.logger.error(
        `AI generation failed for chat ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }

    try {
      const bot = this.registry.getBotForClient(clientId);
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      // Store so future AI turns have the recovery line in their context.
      await this.chat.addMessage(chatId, clientId, 'assistant', message);
      this.logger.log(
        `Recovery message sent to chat ${chatId} (client #${clientId})`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to deliver recovery to chat ${chatId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ── Prompt ───────────────────────────────────────────────

  /**
   * Build the "gentle follow-up" prompt and route it through the configured
   * provider. We deliberately use a fresh, minimal system prompt here rather
   * than reusing `ClientService.buildPrompt` — the goal is a single warm
   * nudge, not another full BANT cycle.
   */
  private async composeFollowUp(
    session: ChatSession,
    client: Client,
    lang: Lang,
  ): Promise<string> {
    const langName = LANG_NAMES[lang] ?? 'English';
    const idleHours = Math.round(
      (Date.now() - session.lastMessageAt.getTime()) / (60 * 60 * 1000),
    );

    const history = await this.chat.getRecentHistory(session.chatId, client.id);
    const lastUser = [...history].reverse().find((h) => h.role === 'user');

    const systemPrompt = `You are a warm, non-pushy customer-success agent for "${client.name}".
The user stopped replying about ${idleHours}h ago after chatting with us on Telegram.
Your job is to send ONE short follow-up message that:
  • greets them by tone (not by name — we don't know it),
  • references what they were asking about if you can infer it from the last user turn below,
  • invites them to continue — ONE open question, no pressure,
  • stays under 2 short sentences + the question,
  • never mentions scoring, BANT, or internal tooling,
  • contains no emoji spam (max one),
  • responds in ${langName}.
Do NOT say "Just following up" literally — vary the opener.`;

    const userTurn = lastUser
      ? `The last thing the user said was:\n"""${lastUser.message}"""\nWrite the follow-up message now.`
      : `We have no prior message to quote. Write a warm, generic follow-up that invites them to continue the conversation.`;

    return this.ai.ask(userTurn, systemPrompt, undefined, {
      aiProvider: client.aiProvider,
      aiModel: client.aiModel,
    });
  }

  private resolveLang(sessionLang: string, clientLang: string): Lang {
    const candidate = (sessionLang || clientLang || 'en') as Lang;
    return candidate === 'uz' || candidate === 'ru' || candidate === 'en'
      ? candidate
      : 'en';
  }
}

const LANG_NAMES: Record<Lang, string> = {
  uz: 'Uzbek',
  ru: 'Russian',
  en: 'English',
};
