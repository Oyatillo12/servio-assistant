import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { FlowStateService, LeadStep } from './flow-state.service.js';
import { OrderFlowService } from './order-flow.service.js';
import { LeadFlowService } from './lead-flow.service.js';
import type { Client } from '../client/entities/client.entity.js';
import { I18nService, type Lang } from '../i18n/i18n.service.js';

@Injectable()
export class FlowRouterService {
  private readonly logger = new Logger(FlowRouterService.name);

  constructor(
    private readonly state: FlowStateService,
    private readonly orderFlow: OrderFlowService,
    private readonly leadFlow: LeadFlowService,
    private readonly i18n: I18nService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  Start flow based on client type
  // ═══════════════════════════════════════════════════════

  async startFlow(
    chatId: number,
    client: Client,
    bot: TelegramBot,
    lang: Lang,
    productId?: number,
  ): Promise<void> {
    // Clear any existing flow before starting a new one
    this.state.clearState(chatId);

    this.logger.log(
      `Chat ${chatId} → starting "${client.type}" flow for client "${client.name}" ${productId ? `(product: ${productId})` : ''}`,
    );

    switch (client.type) {
      case 'order':
        await this.orderFlow.start(chatId, client.id, bot, lang, productId);
        break;
      case 'lead':
        await this.leadFlow.start(chatId, client.id, bot, lang);
        break;
      default:
        this.logger.warn(`Unknown client type: ${client.type as string}`);
        await this.orderFlow.start(chatId, client.id, bot, lang, productId);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Route incoming text message to active flow
  // ═══════════════════════════════════════════════════════

  async handleMessage(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    const flowType = this.state.getFlowType(chatId);

    switch (flowType) {
      case 'order':
        await this.orderFlow.handleMessage(chatId, text, bot, lang);
        break;
      case 'lead':
        await this.leadFlow.handleMessage(chatId, text, bot, lang);
        break;
      default:
        await this.handleExpired(chatId, bot, lang);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Route callback query to active flow
  // ═══════════════════════════════════════════════════════

  async handleCallback(
    chatId: number,
    data: string,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    const flowType = this.state.getFlowType(chatId);

    switch (flowType) {
      case 'order':
        await this.orderFlow.handleCallback(chatId, data, bot, lang, messageId);
        break;
      case 'lead':
        await this.leadFlow.handleCallback(chatId, data, bot, lang, messageId);
        break;
      default:
        await this.handleExpired(chatId, bot, lang, messageId);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Fallback for expired / missing flow state
  // ═══════════════════════════════════════════════════════

  /**
   * Called when a user interacts with a flow that no longer exists in memory
   * (TTL expired, server restarted, or stale inline button on an old message).
   * Strip the stale buttons and nudge the user to restart.
   */
  private async handleExpired(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.logger.warn(`Flow state missing/expired for chat ${chatId}`);

    // Strip the stale inline buttons so they can't be clicked again
    if (messageId) {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
      } catch {
        // ignore — message may be too old to edit
      }
    }

    try {
      await bot.sendMessage(chatId, this.i18n.t('flow_expired', lang), {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `🏠 ${this.i18n.t('btn_main_menu', lang)}`,
                callback_data: 'nav:main',
              },
            ],
          ],
        },
      });
    } catch {
      // ignore send failure
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Check if chat is in an active flow
  // ═══════════════════════════════════════════════════════

  isInFlow(chatId: number): boolean {
    return this.state.isInFlow(chatId);
  }

  clearFlow(chatId: number): void {
    this.state.clearState(chatId);
  }

  /**
   * Silently enter the lead flow AI-chat state without sending any messages.
   * Used when a lead-type client sends a free-text message outside an active flow
   * so the reply includes the "Leave your contact" button.
   */
  initLeadState(chatId: number, clientId: number): void {
    this.state.startFlow(chatId, 'lead', LeadStep.AI_CHAT, clientId);
  }
}
