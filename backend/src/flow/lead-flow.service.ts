import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { FlowStateService, LeadStep } from './flow-state.service.js';
import { LeadService } from '../lead/lead.service.js';
import { AiService } from '../ai/ai.service.js';
import { ClientService } from '../client/client.service.js';
import { ChatService } from '../chat/chat.service.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { BotService } from '../bot/bot.service.js';

@Injectable()
export class LeadFlowService {
  private readonly logger = new Logger(LeadFlowService.name);

  constructor(
    private readonly state: FlowStateService,
    private readonly leadService: LeadService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly i18n: I18nService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  Start flow — enter AI chat mode
  // ═══════════════════════════════════════════════════════

  async start(
    chatId: number,
    clientId: number,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    this.state.startFlow(chatId, 'lead', LeadStep.AI_CHAT, clientId);

    const sent = await bot.sendMessage(
      chatId,
      this.i18n.t('lead_welcome', lang),
      {
        parse_mode: 'Markdown',
        reply_markup: this.aiChatKeyboard(lang),
      },
    );
    this.state.setMessageId(chatId, sent.message_id);
  }

  // ═══════════════════════════════════════════════════════
  //  Handle text messages
  // ═══════════════════════════════════════════════════════

  async handleMessage(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    try {
      const step = this.state.getStep(chatId);

      switch (step) {
        case LeadStep.AI_CHAT:
          await this.handleAiChat(chatId, text, bot, lang);
          break;
        case LeadStep.ENTER_NAME:
          await this.handleName(chatId, text, bot, lang);
          break;
        case LeadStep.ENTER_PHONE:
          await this.handlePhone(chatId, text, bot, lang);
          break;
        default:
          await bot.sendMessage(chatId, this.i18n.t('lead_use_buttons', lang));
          break;
      }
    } catch (err) {
      this.logger.error(
        `LeadFlow handleMessage error — chat ${chatId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      this.state.clearState(chatId);
      try {
        await bot.sendMessage(chatId, this.i18n.t('error_fallback', lang));
      } catch {
        // ignore
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Handle inline callbacks
  // ═══════════════════════════════════════════════════════

  async handleCallback(
    chatId: number,
    data: string,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    try {
      const [action, ...rest] = data.split(':');
      const value = rest.join(':');

      switch (action) {
        case 'leave_contact':
          await this.onLeaveContact(chatId, bot, lang, messageId);
          break;
        case 'confirm':
          await this.onConfirm(chatId, bot, lang, messageId);
          break;
        case 'cancel':
          await this.onCancel(chatId, bot, lang, messageId);
          break;
        case 'back':
          await this.onBack(chatId, value, bot, lang, messageId);
          break;
        default:
          this.logger.warn(`Unknown lead callback: ${data}`);
      }
    } catch (err) {
      this.logger.error(
        `LeadFlow handleCallback error — chat ${chatId}, data "${data}": ${(err as Error).message}`,
        (err as Error).stack,
      );
      this.state.clearState(chatId);
      try {
        await bot.sendMessage(chatId, this.i18n.t('error_fallback', lang));
      } catch {
        // ignore
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  AI Chat step
  // ═══════════════════════════════════════════════════════

  private async handleAiChat(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    const clientId = this.state.getState(chatId)?.clientId;
    if (!clientId) return;

    // Strip "Leave contact" buttons from the previous AI response
    await this.state.stripOldButtons(chatId, bot);

    // Persist user message
    await this.chatService.addMessage(chatId, clientId, 'user', text);

    // Broadcast user message to admins
    this.chatGateway.broadcastChatMessage({
      chatId,
      clientId,
      role: 'user',
      message: text,
      at: new Date().toISOString(),
    });

    // AI-off guard — admin has taken over
    const session = await this.chatService.getSession(chatId);
    if (session && !session.isAiActive) {
      return;
    }

    // Delegate to Sales AI pipeline (BANT qualification + scoring)
    const { reply, session: updatedSession } =
      await this.botService.handleSalesAiChat(bot, chatId, clientId, lang, text);

    this.state.updateData(chatId, 'lastQuestion', text);
    this.state.updateData(chatId, 'aiNotes', reply);

    // Get client for smart keyboard context
    const client = await this.clientService.findOne(clientId);

    // Send AI response with smart intent-based inline buttons
    const keyboard = this.botService.buildSmartKeyboard(
      updatedSession,
      lang,
      client.hasProducts,
      client.hasServices,
    );

    const sent = await bot.sendMessage(chatId, reply, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
    this.state.setMessageId(chatId, sent.message_id);
  }

  // ═══════════════════════════════════════════════════════
  //  Contact collection steps
  // ═══════════════════════════════════════════════════════

  private async onLeaveContact(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.setStep(chatId, LeadStep.ENTER_NAME);

    // Edit the AI response message → name prompt (reuses the same message)
    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('lead_enter_name', lang),
      this.backCancelKeyboard(lang, 'ai_chat'),
      messageId,
    );
  }

  private async handleName(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    const name = text.trim();

    // Strip stale buttons from the "enter name" prompt
    await this.state.stripOldButtons(chatId, bot);

    if (name.length < 2) {
      const sent = await bot.sendMessage(
        chatId,
        this.i18n.t('lead_invalid_name', lang),
        {
          parse_mode: 'Markdown',
          reply_markup: this.backCancelKeyboard(lang, 'ai_chat'),
        },
      );
      this.state.setMessageId(chatId, sent.message_id);
      return;
    }

    this.state.updateData(chatId, 'name', name);
    this.state.setStep(chatId, LeadStep.ENTER_PHONE);

    const sent = await bot.sendMessage(
      chatId,
      this.i18n.t('lead_enter_phone', lang),
      {
        parse_mode: 'Markdown',
        reply_markup: this.backCancelKeyboard(lang, 'name'),
      },
    );
    this.state.setMessageId(chatId, sent.message_id);
  }

  private async handlePhone(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    const phone = text.trim();

    // Strip stale buttons from the "enter phone" prompt
    await this.state.stripOldButtons(chatId, bot);

    if (phone.length < 5) {
      const sent = await bot.sendMessage(
        chatId,
        this.i18n.t('lead_invalid_phone', lang),
        {
          parse_mode: 'Markdown',
          reply_markup: this.backCancelKeyboard(lang, 'name'),
        },
      );
      this.state.setMessageId(chatId, sent.message_id);
      return;
    }

    this.state.updateData(chatId, 'phone', phone);
    this.state.setStep(chatId, LeadStep.CONFIRM);

    const s = this.state.getState(chatId);
    if (!s) return;

    const summaryText = this.i18n.t('lead_summary', lang, {
      name: (s.data['name'] as string) ?? '—',
      phone,
    });

    const sent = await bot.sendMessage(chatId, summaryText, {
      parse_mode: 'Markdown',
      reply_markup: this.confirmCancelKeyboard(lang),
    });
    this.state.setMessageId(chatId, sent.message_id);
  }

  // ═══════════════════════════════════════════════════════
  //  Confirm / Cancel
  // ═══════════════════════════════════════════════════════

  private async onConfirm(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    const s = this.state.getState(chatId);
    if (!s) return;

    const notes =
      (s.data['lastQuestion'] as string) ??
      (s.data['aiNotes'] as string) ??
      null;

    const lead = await this.leadService.create({
      chatId,
      clientId: s.clientId,
      name: (s.data['name'] as string) ?? '',
      phone: (s.data['phone'] as string) ?? '',
      notes,
    });

    this.state.clearState(chatId);

    const client = await this.clientService.findOne(s.clientId);
    await this.notificationService.notifyNewLead(bot, client, lead, lang);

    this.logger.log(`Lead #${lead.id} saved — chat ${chatId}`);

    // Edit the summary message → confirmation
    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('lead_saved', lang),
      {
        inline_keyboard: [
          [
            {
              text: `🏠 ${this.i18n.t('btn_main_menu', lang)}`,
              callback_data: 'nav:main',
            },
          ],
        ],
      },
      messageId,
    );
  }

  private async onCancel(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.clearState(chatId);

    // Edit current message → cancellation notice
    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('lead_cancelled', lang),
      {
        inline_keyboard: [
          [
            {
              text: `🏠 ${this.i18n.t('btn_main_menu', lang)}`,
              callback_data: 'nav:main',
            },
          ],
        ],
      },
      messageId,
    );
  }

  // ═══════════════════════════════════════════════════════
  //  Back navigation
  // ═══════════════════════════════════════════════════════

  private async onBack(
    chatId: number,
    target: string,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    switch (target) {
      case 'ai_chat':
        this.state.setStep(chatId, LeadStep.AI_CHAT);
        await this.editOrSend(
          chatId,
          bot,
          this.i18n.t('lead_back_to_chat', lang),
          this.aiChatKeyboard(lang),
          messageId,
        );
        break;
      case 'name':
        this.state.setStep(chatId, LeadStep.ENTER_NAME);
        await this.editOrSend(
          chatId,
          bot,
          this.i18n.t('lead_enter_name', lang),
          this.backCancelKeyboard(lang, 'ai_chat'),
          messageId,
        );
        break;
      default:
        break;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Keyboard builders
  // ═══════════════════════════════════════════════════════

  private aiChatKeyboard(lang: Lang): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `📝 ${this.i18n.t('btn_leave_contact', lang)}`,
            callback_data: 'flow:leave_contact',
          },
        ],
        [
          {
            text: `🏠 ${this.i18n.t('btn_main_menu', lang)}`,
            callback_data: 'flow:cancel',
          },
        ],
      ],
    };
  }

  private backCancelKeyboard(
    lang: Lang,
    backTarget: string,
  ): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `◀️ ${this.i18n.t('btn_back', lang)}`,
            callback_data: `flow:back:${backTarget}`,
          },
          {
            text: `❌ ${this.i18n.t('btn_cancel', lang)}`,
            callback_data: 'flow:cancel',
          },
        ],
      ],
    };
  }

  private confirmCancelKeyboard(lang: Lang): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `✅ ${this.i18n.t('btn_confirm', lang)}`,
            callback_data: 'flow:confirm',
          },
          {
            text: `❌ ${this.i18n.t('btn_cancel', lang)}`,
            callback_data: 'flow:cancel',
          },
        ],
      ],
    };
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Edit the existing message if possible, otherwise send a new one.
   * Tries the passed messageId first, then the tracked messageId.
   */
  private async editOrSend(
    chatId: number,
    bot: TelegramBot,
    text: string,
    replyMarkup: TelegramBot.InlineKeyboardMarkup,
    messageId?: number,
  ): Promise<void> {
    const targetId = messageId ?? this.state.getMessageId(chatId);

    if (targetId) {
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: targetId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
        this.state.setMessageId(chatId, targetId);
        return;
      } catch {
        // Fall through to send
      }
    }

    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
    this.state.setMessageId(chatId, sent.message_id);
  }
}
