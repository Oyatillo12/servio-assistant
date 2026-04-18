import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import { AiService } from '../ai/ai.service.js';
import { ClientService } from '../client/client.service.js';
import { ChatService } from '../chat/chat.service.js';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import { BotUiService } from './bot-ui.service.js';
import { formatPrice } from '../common/utils/currency.util.js';
import { FlowRouterService } from '../flow/flow-router.service.js';

/** Delay to simulate natural typing (ms) */
const TYPING_DELAY_MS = 600;

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot!: TelegramBot;

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly clientService: ClientService,
    private readonly chatService: ChatService,
    private readonly i18n: I18nService,
    private readonly ui: BotUiService,
    private readonly flowRouter: FlowRouterService,
  ) {}

  onModuleInit() {
    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new TelegramBot(token, { polling: true });

    this.registerHandlers();
    this.logger.log('Telegram bot started (polling)');
  }

  // ═══════════════════════════════════════════════════════
  //  Handler Registration
  // ═══════════════════════════════════════════════════════

  private registerHandlers() {
    this.bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
      void this.handleStart(msg, match?.[1]?.trim());
    });

    this.bot.onText(
      /\/lang/,
      (msg) => void this.handleLanguageCommand(msg.chat.id),
    );
    this.bot.onText(
      /\/menu/,
      (msg) => void this.handleMenuCommand(msg.chat.id),
    );

    this.bot.on('callback_query', (query) => void this.handleCallback(query));
    this.bot.on('message', (msg) => void this.handleMessage(msg));
  }

  // ═══════════════════════════════════════════════════════
  //  /start command
  // ═══════════════════════════════════════════════════════

  private async handleStart(msg: TelegramBot.Message, slug?: string) {
    const chatId = msg.chat.id;

    if (!slug) {
      await this.sendTyping(chatId);
      void this.bot.sendMessage(chatId, this.i18n.t('welcome', 'en'), {
        reply_markup: this.ui.removeKeyboard(),
      });
      return;
    }

    const client = await this.clientService.findBySlug(slug);
    if (!client) {
      void this.bot.sendMessage(chatId, this.i18n.t('unknown_provider', 'en'));
      return;
    }

    // Preserve user's prior language choice if they've used this bot before;
    // otherwise use the client's configured default language.
    const existing = await this.chatService.getSession(chatId);
    const prior = existing?.lang;
    const fallback = client.defaultLang ?? 'ru';
    const lang: Lang =
      prior && this.i18n.isValidLang(prior)
        ? prior
        : this.i18n.isValidLang(fallback)
          ? fallback
          : 'en';

    await this.chatService.setSession(chatId, client.id, lang);
    this.flowRouter.clearFlow(chatId);

    await this.sendTyping(chatId);

    const botConfig = client.parsedBotConfig;
    const welcomeMsg = botConfig.welcomeMessage
      ? botConfig.welcomeMessage.replace('{name}', client.name)
      : this.i18n.t('welcome_connected', lang, { name: client.name });

    void this.bot.sendMessage(chatId, welcomeMsg, {
      parse_mode: 'Markdown',
      reply_markup: this.ui.mainMenuKeyboard(
        lang,
        botConfig,
        client.type,
        client.hasProducts,
        client.hasServices,
      ),
    });

    this.logger.log(`Chat ${chatId} → client "${client.name}" (lang: ${lang})`);
  }

  // ═══════════════════════════════════════════════════════
  //  Commands
  // ═══════════════════════════════════════════════════════

  private async handleLanguageCommand(chatId: number) {
    const lang = await this.getLang(chatId);
    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, this.i18n.t('choose_language', lang), {
      reply_markup: this.ui.languageKeyboard(),
    });
  }

  private async handleMenuCommand(chatId: number) {
    const lang = await this.getLang(chatId);
    this.flowRouter.clearFlow(chatId);
    await this.sendTyping(chatId);
    const client = await this.getClient(chatId);
    void this.bot.sendMessage(chatId, this.i18n.t('main_menu', lang), {
      reply_markup: this.ui.mainMenuKeyboard(
        lang,
        client?.parsedBotConfig,
        client?.type,
        client?.hasProducts ?? true,
        client?.hasServices ?? true,
      ),
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Callback Query Router
  // ═══════════════════════════════════════════════════════

  private async handleCallback(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    if (!chatId || !query.data) return;

    void this.bot.answerCallbackQuery(query.id);

    try {
      const [action, ...rest] = query.data.split(':');
      const value = rest.join(':');

      const lang = await this.getLang(chatId);

      // Clean up inline keyboard from the callback message to avoid clutter
      if (messageId && action !== 'flow' && action !== 'product') {
        try {
          await this.bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: messageId },
          );
        } catch {
          // ignore — message may already be edited or too old
        }
      }

      switch (action) {
        case 'lang':
          await this.handleSetLanguage(chatId, value, messageId);
          break;
        case 'menu':
          await this.handleMenuAction(chatId, value, messageId);
          break;
        case 'nav':
          await this.handleNavigation(chatId, value, messageId);
          break;
        case 'product':
          await this.handleProductDetail(chatId, Number(value), messageId);
          break;
        case 'order_product': {
          const session = await this.chatService.getSession(chatId);
          if (!session) break;

          let client: import('../client/entities/client.entity.js').Client;
          try {
            client = await this.clientService.findOne(session.clientId);
          } catch {
            void this.bot.sendMessage(
              chatId,
              this.i18n.t('error_fallback', lang),
            );
            break;
          }

          // Order flow is only valid for order-type clients with products enabled
          if (client.type !== 'order' || !client.hasProducts) {
            this.logger.warn(
              `order_product callback rejected — client #${client.id} type=${client.type} hasProducts=${client.hasProducts}`,
            );
            break;
          }

          if (messageId) {
            await this.bot.deleteMessage(chatId, messageId).catch(() => {});
          }

          await this.bot.sendMessage(
            chatId,
            this.i18n.t('flow_starting', lang),
            { reply_markup: this.ui.removeKeyboard() },
          );

          await this.flowRouter.startFlow(
            chatId,
            client,
            this.bot,
            lang,
            Number(value),
          );
          break;
        }
        case 'flow':
          // If "leave_contact" arrives but flow state expired, re-init lead state
          if (value === 'leave_contact' && !this.flowRouter.isInFlow(chatId)) {
            const session = await this.chatService.getSession(chatId);
            if (session) {
              this.flowRouter.initLeadState(chatId, session.clientId);
            }
          }
          await this.flowRouter.handleCallback(
            chatId,
            value,
            this.bot,
            lang,
            query.message?.message_id,
          );
          break;
        default:
          this.logger.warn(`Unknown callback: ${query.data}`);
      }
    } catch (err) {
      this.logger.error(
        `handleCallback error — chat ${chatId}, data "${query.data}": ${(err as Error).message}`,
        (err as Error).stack,
      );
      try {
        const lang = await this.getLang(chatId);
        await this.bot.sendMessage(chatId, this.i18n.t('error_fallback', lang));
      } catch {
        // ignore secondary failure
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Language
  // ═══════════════════════════════════════════════════════

  private async handleSetLanguage(
    chatId: number,
    langCode: string,
    messageId?: number,
  ) {
    if (!this.i18n.isValidLang(langCode)) return;
    await this.chatService.setLanguage(chatId, langCode);

    if (messageId) {
      await this.bot.deleteMessage(chatId, messageId).catch(() => {});
    }

    await this.sendTyping(chatId);
    const client = await this.getClient(chatId);
    void this.bot.sendMessage(chatId, this.i18n.t('language_set', langCode), {
      reply_markup: this.ui.mainMenuKeyboard(
        langCode,
        client?.parsedBotConfig,
        client?.type,
        client?.hasProducts ?? true,
        client?.hasServices ?? true,
      ),
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Navigation
  // ═══════════════════════════════════════════════════════

  private async handleNavigation(
    chatId: number,
    target: string,
    messageId?: number,
  ) {
    const lang = await this.getLang(chatId);
    this.flowRouter.clearFlow(chatId);

    if (target === 'main') {
      if (messageId) {
        await this.bot.deleteMessage(chatId, messageId).catch(() => {});
      }
      await this.sendTyping(chatId);
      const client = await this.getClient(chatId);
      void this.bot.sendMessage(chatId, this.i18n.t('main_menu', lang), {
        reply_markup: this.ui.mainMenuKeyboard(
          lang,
          client?.parsedBotConfig,
          client?.type,
          client?.hasProducts ?? true,
          client?.hasServices ?? true,
        ),
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Menu Actions (Products / Services / Contact)
  // ═══════════════════════════════════════════════════════

  private async handleMenuAction(
    chatId: number,
    action: string,
    messageId?: number,
  ) {
    const session = await this.chatService.getSession(chatId);
    if (!session) {
      void this.bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
      return;
    }

    const lang = (session.lang as Lang) ?? 'en';
    const client = await this.clientService.findOne(session.clientId);

    switch (action) {
      case 'products':
        await this.showProducts(chatId, client, lang, messageId);
        break;
      case 'services':
        await this.showServices(chatId, client, lang, messageId);
        break;
      case 'lang':
        if (messageId) {
          await this.bot.deleteMessage(chatId, messageId).catch(() => {});
        }
        await this.handleLanguageCommand(chatId);
        break;
      default:
        this.logger.warn(`Unknown menu action: ${action}`);
    }
  }

  private async showProducts(
    chatId: number,
    client: import('../client/entities/client.entity.js').Client,
    lang: Lang,
    messageId?: number,
  ) {
    const products = client.products.filter((p) => p.isActive);

    if (products.length === 0) {
      if (messageId) {
        await this.bot
          .editMessageText(this.i18n.t('products_empty', lang), {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } else {
        await this.sendTyping(chatId);
        void this.bot.sendMessage(chatId, this.i18n.t('products_empty', lang));
      }
      return;
    }

    const text = this.i18n.t('products_title', lang);
    const reply_markup = this.ui.productListKeyboard(products, lang);

    if (messageId) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup,
        });
        return;
      } catch {
        // Ignore fallback
      }
    }

    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  private async showServices(
    chatId: number,
    client: import('../client/entities/client.entity.js').Client,
    lang: Lang,
    messageId?: number,
  ) {
    const services = client.services.filter((s) => s.isActive);

    if (services.length === 0) {
      if (messageId) {
        await this.bot
          .editMessageText(this.i18n.t('services_empty', lang), {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } else {
        await this.sendTyping(chatId);
        void this.bot.sendMessage(chatId, this.i18n.t('services_empty', lang));
      }
      return;
    }

    const text =
      this.i18n.t('services_title', lang) +
      services
        .map(
          (s) => `• *${s.name}*${s.description ? `\n  ${s.description}` : ''}`,
        )
        .join('\n\n');

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: `◀️ ${this.i18n.t('btn_back', lang)}`,
            callback_data: 'nav:main',
          },
        ],
      ],
    };

    if (messageId) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup,
        });
        return;
      } catch (e) {}
    }

    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  // ── About (lead: services + Leave Contact CTA) ──────────

  private async showAbout(
    chatId: number,
    client: import('../client/entities/client.entity.js').Client,
    lang: Lang,
  ) {
    const services = client.services.filter((s) => s.isActive);

    const text =
      services.length > 0
        ? this.i18n.t('services_title', lang) +
          services
            .map(
              (s) =>
                `• *${s.name}*${s.price != null ? ` — ${formatPrice(s.price, client.currency)}` : ''}${s.description ? `\n  ${s.description}` : ''}`,
            )
            .join('\n\n')
        : this.i18n.t('services_empty', lang);

    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `📝 ${this.i18n.t('btn_leave_contact', lang)}`,
              callback_data: 'flow:leave_contact',
            },
          ],
          [
            {
              text: `◀️ ${this.i18n.t('btn_back', lang)}`,
              callback_data: 'nav:main',
            },
          ],
        ],
      },
    });
  }

  // ── Prices (lead: product price list + Leave Contact CTA) ─

  private async showPrices(
    chatId: number,
    client: import('../client/entities/client.entity.js').Client,
    lang: Lang,
  ) {
    const products = client.products.filter((p) => p.isActive);

    const text =
      products.length > 0
        ? this.i18n.t('prices_title', lang) +
          products
            .map(
              (p) =>
                `• *${p.name}*${p.price != null ? ` — ${formatPrice(p.price, client.currency)}` : ''}${p.description ? `\n  ${p.description}` : ''}`,
            )
            .join('\n\n')
        : this.i18n.t('prices_empty', lang);

    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `📝 ${this.i18n.t('btn_leave_contact', lang)}`,
              callback_data: 'flow:leave_contact',
            },
          ],
          [
            {
              text: `◀️ ${this.i18n.t('btn_back', lang)}`,
              callback_data: 'nav:main',
            },
          ],
        ],
      },
    });
  }

  // ── Product detail ──────────────────────────────────────

  private async handleProductDetail(
    chatId: number,
    productId: number,
    messageId?: number,
  ) {
    const session = await this.chatService.getSession(chatId);
    if (!session) return;

    const lang = (session.lang as Lang) ?? 'en';
    const client = await this.clientService.findOne(session.clientId);
    const product = client.products.find((p) => p.id === productId);
    if (!product) return;

    const templateKey =
      product.price != null ? 'product_detail' : 'product_detail_no_price';
    const text = this.i18n.t(templateKey, lang, {
      name: product.name,
      description: product.description || '—',
      price: product.price != null ? formatPrice(product.price, client.currency) : '',
    });

    const reply_markup = this.ui.productDetailKeyboard(productId, lang);

    if (messageId) {
      try {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup,
        });
        return;
      } catch (e) {}
    }

    await this.sendTyping(chatId);
    void this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Contact
  // ═══════════════════════════════════════════════════════

  private async showContact(chatId: number) {
    const session = await this.chatService.getSession(chatId);
    if (!session) {
      void this.bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
      return;
    }

    const lang = (session.lang as Lang) ?? 'en';
    const client = await this.clientService.findOne(session.clientId);
    const botConfig = client.parsedBotConfig;
    await this.sendTyping(chatId);

    void this.bot.sendMessage(
      chatId,
      `${this.i18n.t('contact_title', lang)} ${botConfig.contactPhone || ''}`,
      {
        parse_mode: 'Markdown',
        reply_markup: this.ui.contactKeyboard(
          lang,
          botConfig.contactPhone,
          botConfig.contactWebsite,
        ),
      },
    );
  }

  // ═══════════════════════════════════════════════════════
  //  Message Handler (main router)
  // ═══════════════════════════════════════════════════════

  private async handleMessage(msg: TelegramBot.Message) {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;

    try {
      const session = await this.chatService.getSession(chatId);

      if (!session) {
        void this.bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
        return;
      }

      const lang = (session.lang as Lang) ?? 'en';
      const text = msg.text.trim();

      // 1️⃣ Active flow — route to current flow handler
      if (this.flowRouter.isInFlow(chatId)) {
        await this.flowRouter.handleMessage(chatId, text, this.bot, lang);
        return;
      }

      // 2️⃣ Reply-keyboard button press
      if (await this.routeMenuButton(chatId, text, lang)) {
        return;
      }

      // 3️⃣ Lead-type clients: silently enter lead AI-chat state so every
      //    AI reply includes the "Leave your contact" button for lead capture.
      const client = await this.clientService.findOne(session.clientId);
      if (client.type === 'lead') {
        this.flowRouter.initLeadState(chatId, client.id);
        await this.flowRouter.handleMessage(chatId, text, this.bot, lang);
        return;
      }

      // 4️⃣ Order-type clients: plain AI chat
      await this.handleAiChat(chatId, session, lang, text);
    } catch (err) {
      this.logger.error(
        `handleMessage error — chat ${chatId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      try {
        await this.bot.sendMessage(chatId, this.i18n.t('error_fallback', 'en'));
      } catch {
        // ignore secondary failure
      }
    }
  }

  // ── Route reply‑keyboard button presses ─────────────────

  private async routeMenuButton(
    chatId: number,
    text: string,
    lang: Lang,
  ): Promise<boolean> {
    // Check all languages for robustness (user might switch lang after keyboard was set)
    const allLabels = (['uz', 'ru', 'en'] as Lang[]).flatMap((l) => {
      const lb = this.i18n.getMenuLabels(l);
      return Object.entries(lb).map(([key, value]) => ({ key, value }));
    });

    const matchedKey = allLabels.find((l) => l.value === text)?.key;
    if (!matchedKey) return false;

    switch (matchedKey) {
      case 'products': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (!client.hasProducts) return false;
        await this.showProducts(chatId, client, lang);
        return true;
      }
      case 'services': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (!client.hasServices) return false;
        await this.showServices(chatId, client, lang);
        return true;
      }
      case 'order': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type === 'lead' || !client.hasProducts) return false;
        // Remove ReplyKeyboard for a clean flow experience
        await this.bot.sendMessage(chatId, this.i18n.t('flow_starting', lang), {
          reply_markup: this.ui.removeKeyboard(),
        });
        await this.flowRouter.startFlow(chatId, client, this.bot, lang);
        return true;
      }
      case 'about': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type !== 'lead' || !client.hasServices) return false;
        await this.showAbout(chatId, client, lang);
        this.flowRouter.initLeadState(chatId, client.id);
        return true;
      }
      case 'prices': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type !== 'lead' || !client.hasProducts) return false;
        await this.showPrices(chatId, client, lang);
        this.flowRouter.initLeadState(chatId, client.id);
        return true;
      }
      case 'contact':
        await this.showContact(chatId);
        return true;
      case 'language':
        await this.handleLanguageCommand(chatId);
        return true;
      case 'ai_chat':
        await this.sendTyping(chatId);
        void this.bot.sendMessage(chatId, this.i18n.t('ai_chat_active', lang), {
          parse_mode: 'Markdown',
        });
        return true;
      default:
        return false;
    }
  }

  // ── AI chat handler ─────────────────────────────────────

  private async handleAiChat(
    chatId: number,
    session: { clientId: number; lang: string },
    lang: Lang,
    text: string,
  ) {
    const client = await this.clientService.findOne(session.clientId);
    const systemPrompt = this.clientService.buildPrompt(client, lang);

    void this.bot.sendChatAction(chatId, 'typing');

    const history = await this.chatService.getRecentHistory(chatId, client.id);
    await this.chatService.addMessage(chatId, client.id, 'user', text);

    const reply = await this.aiService.ask(text, systemPrompt, history);

    await this.chatService.addMessage(chatId, client.id, 'assistant', reply);

    void this.bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════

  /** Simulate typing for a more natural feel */
  private async sendTyping(chatId: number): Promise<void> {
    void this.bot.sendChatAction(chatId, 'typing');
    await this.delay(TYPING_DELAY_MS);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Get the current language for a chat, falling back to 'en' */
  private async getLang(chatId: number): Promise<Lang> {
    const session = await this.chatService.getSession(chatId);
    const lang = session?.lang ?? 'en';
    return this.i18n.isValidLang(lang) ? lang : 'en';
  }

  /** Get the full client for the chat session */
  private async getClient(
    chatId: number,
  ): Promise<import('../client/entities/client.entity.js').Client | undefined> {
    const session = await this.chatService.getSession(chatId);
    if (!session) return undefined;
    try {
      return await this.clientService.findOne(session.clientId);
    } catch {
      return undefined;
    }
  }
}
