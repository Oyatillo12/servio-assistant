import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { AiService } from '../ai/ai.service.js';
import { SalesAiService } from '../ai/sales-ai.service.js';
import { ClientService } from '../client/client.service.js';
import { ChatService } from '../chat/chat.service.js';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import { BotUiService } from './bot-ui.service.js';
import { formatPrice } from '../common/utils/currency.util.js';
import { FlowRouterService } from '../flow/flow-router.service.js';
import type { BotBinding } from './bot-registry.service.js';
import type { Client } from '../client/entities/client.entity.js';

/** Delay to simulate natural typing (ms) */
const TYPING_DELAY_MS = 600;

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly aiService: AiService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly chatService: ChatService,
    private readonly salesAi: SalesAiService,
    private readonly i18n: I18nService,
    private readonly ui: BotUiService,
    private readonly flowRouter: FlowRouterService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  Handler Registration (called per bot instance)
  // ═══════════════════════════════════════════════════════

  registerHandlers(bot: TelegramBot, binding: BotBinding): void {
    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
      void this.handleStart(bot, binding, msg, match?.[1]?.trim());
    });

    bot.onText(
      /\/lang/,
      (msg) => void this.handleLanguageCommand(bot, msg.chat.id),
    );
    bot.onText(
      /\/menu/,
      (msg) => void this.handleMenuCommand(bot, msg.chat.id),
    );

    bot.on(
      'callback_query',
      (query) => void this.handleCallback(bot, binding, query),
    );
    bot.on('message', (msg) => void this.handleMessage(bot, binding, msg));
  }

  // ═══════════════════════════════════════════════════════
  //  /start command
  // ═══════════════════════════════════════════════════════

  private async handleStart(
    bot: TelegramBot,
    binding: BotBinding,
    msg: TelegramBot.Message,
    slug?: string,
  ) {
    const chatId = msg.chat.id;

    // Per-client bot: clientId is fixed by binding, ignore slug
    const client =
      binding.clientId != null
        ? await this.clientService.findOne(binding.clientId).catch(() => null)
        : slug
          ? await this.clientService.findBySlug(slug)
          : null;

    if (!client) {
      if (binding.clientId == null && !slug) {
        // General bot, no slug — generic welcome
        await this.sendTyping(bot, chatId);
        void bot.sendMessage(chatId, this.i18n.t('welcome', 'uz'), {
          reply_markup: this.ui.removeKeyboard(),
        });
        return;
      }
      void bot.sendMessage(chatId, this.i18n.t('unknown_provider', 'uz'));
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

    await this.sendTyping(bot, chatId);

    // ── Lead-type: AI-generated opening hook ──────────────
    if (client.type === 'lead') {
      const catalog = this.buildCatalogString(client);
      const syntheticMsg = '[User just opened the chat for the first time]';

      // Persist the synthetic start message so the history always begins with
      // a 'user' entry — required by Gemini and keeps context coherent.
      await this.chatService.addMessage(chatId, client.id, 'user', syntheticMsg);

      const hook = await this.salesAi.generateSalesReply({
        chatId,
        clientId: client.id,
        userMessage: syntheticMsg,
        promptContext: {
          businessName: client.name,
          businessPitch: client.systemPrompt,
          lang: lang as 'uz' | 'ru' | 'en',
          catalog,
        },
        aiProvider: client.aiProvider,
        aiModel: client.aiModel,
      });

      await this.chatService.addMessage(chatId, client.id, 'assistant', hook);

      void bot.sendMessage(chatId, hook, {
        parse_mode: 'Markdown',
        reply_markup: this.minimalLeadKeyboard(lang),
      });

      this.logger.log(
        `Chat ${chatId} → client "${client.name}" (lead, AI hook, lang: ${lang})`,
      );
      return;
    }

    // ── Order-type: static welcome + full reply keyboard ──
    const botConfig = client.parsedBotConfig;
    const welcomeMsg = botConfig.welcomeMessage
      ? botConfig.welcomeMessage.replace('{name}', client.name)
      : this.i18n.t('welcome_connected', lang, { name: client.name });

    void bot.sendMessage(chatId, welcomeMsg, {
      parse_mode: 'Markdown',
      reply_markup: this.ui.mainMenuKeyboard(
        lang,
        botConfig,
        client.type,
        client.hasProducts,
        client.hasServices,
      ),
    });

    this.logger.log(
      `Chat ${chatId} → client "${client.name}" (order, lang: ${lang}, bot: ${binding.clientId == null ? 'general' : `client#${client.id}`})`,
    );
  }

  // ═══════════════════════════════════════════════════════
  //  Commands
  // ═══════════════════════════════════════════════════════

  private async handleLanguageCommand(bot: TelegramBot, chatId: number) {
    const lang = await this.getLang(chatId);
    await this.sendTyping(bot, chatId);

    void bot.sendMessage(chatId, this.i18n.t('choose_language', lang), {
      reply_markup: this.ui.languageKeyboard(),
    });
  }

  private async handleMenuCommand(bot: TelegramBot, chatId: number) {
    const lang = await this.getLang(chatId);
    this.flowRouter.clearFlow(chatId);
    await this.sendTyping(bot, chatId);
    const client = await this.getClient(chatId);
    void bot.sendMessage(chatId, this.i18n.t('main_menu', lang), {
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

  private async handleCallback(
    bot: TelegramBot,
    binding: BotBinding,
    query: TelegramBot.CallbackQuery,
  ) {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    if (!chatId || !query.data) return;

    void bot.answerCallbackQuery(query.id);

    try {
      const [action, ...rest] = query.data.split(':');
      const value = rest.join(':');

      const lang = await this.getLang(chatId);

      // Clean up inline keyboard from the callback message to avoid clutter
      if (messageId && action !== 'flow' && action !== 'product') {
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: messageId },
          );
        } catch {
          // ignore — message may already be edited or too old
        }
      }

      switch (action) {
        case 'lang':
          await this.handleSetLanguage(bot, chatId, value, messageId);
          break;
        case 'menu':
          await this.handleMenuAction(bot, chatId, value, messageId);
          break;
        case 'nav':
          await this.handleNavigation(bot, chatId, value, messageId);
          break;
        case 'product':
          await this.handleProductDetail(bot, chatId, Number(value), messageId);
          break;
        case 'order_product': {
          const clientId = await this.resolveClientId(chatId, binding);
          if (clientId == null) break;

          let client: Client;
          try {
            client = await this.clientService.findOne(clientId);
          } catch {
            void bot.sendMessage(chatId, this.i18n.t('error_fallback', lang));
            break;
          }

          if (client.type !== 'order' || !client.hasProducts) {
            this.logger.warn(
              `order_product callback rejected — client #${client.id} type=${client.type} hasProducts=${client.hasProducts}`,
            );
            break;
          }

          if (messageId) {
            await bot.deleteMessage(chatId, messageId).catch(() => {});
          }

          await bot.sendMessage(chatId, this.i18n.t('flow_starting', lang), {
            reply_markup: this.ui.removeKeyboard(),
          });

          await this.flowRouter.startFlow(
            chatId,
            client,
            bot,
            lang,
            Number(value),
          );
          break;
        }
        case 'flow':
          if (value === 'leave_contact' && !this.flowRouter.isInFlow(chatId)) {
            const clientId = await this.resolveClientId(chatId, binding);
            if (clientId != null) {
              this.flowRouter.initLeadState(chatId, clientId);
            }
          }
          await this.flowRouter.handleCallback(
            chatId,
            value,
            bot,
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
        await bot.sendMessage(chatId, this.i18n.t('error_fallback', lang));
      } catch {
        // ignore secondary failure
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Language
  // ═══════════════════════════════════════════════════════

  private async handleSetLanguage(
    bot: TelegramBot,
    chatId: number,
    langCode: string,
    messageId?: number,
  ) {
    if (!this.i18n.isValidLang(langCode)) return;
    await this.chatService.setLanguage(chatId, langCode);

    if (messageId) {
      await bot.deleteMessage(chatId, messageId).catch(() => {});
    }

    await this.sendTyping(bot, chatId);
    const client = await this.getClient(chatId);
    void bot.sendMessage(chatId, this.i18n.t('language_set', langCode), {
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
    bot: TelegramBot,
    chatId: number,
    target: string,
    messageId?: number,
  ) {
    const lang = await this.getLang(chatId);
    this.flowRouter.clearFlow(chatId);

    if (target === 'main') {
      if (messageId) {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
      }
      await this.sendTyping(bot, chatId);
      const client = await this.getClient(chatId);
      void bot.sendMessage(chatId, this.i18n.t('main_menu', lang), {
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
    bot: TelegramBot,
    chatId: number,
    action: string,
    messageId?: number,
  ) {
    const session = await this.chatService.getSession(chatId);
    if (!session) {
      void bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
      return;
    }

    const lang = (session.lang as Lang) ?? 'en';
    const client = await this.clientService.findOne(session.clientId);

    switch (action) {
      case 'products':
        await this.showProducts(bot, chatId, client, lang, messageId);
        break;
      case 'services':
        await this.showServices(bot, chatId, client, lang, messageId);
        break;
      case 'lang':
        if (messageId) {
          await bot.deleteMessage(chatId, messageId).catch(() => {});
        }
        await this.handleLanguageCommand(bot, chatId);
        break;
      default:
        this.logger.warn(`Unknown menu action: ${action}`);
    }
  }

  private async showProducts(
    bot: TelegramBot,
    chatId: number,
    client: Client,
    lang: Lang,
    messageId?: number,
  ) {
    const products = client.products.filter((p) => p.isActive);

    if (products.length === 0) {
      if (messageId) {
        await bot
          .editMessageText(this.i18n.t('products_empty', lang), {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } else {
        await this.sendTyping(bot, chatId);
        void bot.sendMessage(chatId, this.i18n.t('products_empty', lang));
      }
      return;
    }

    const text = this.i18n.t('products_title', lang);
    const reply_markup = this.ui.productListKeyboard(
      products,
      lang,
      client.currency,
    );

    if (messageId) {
      try {
        await bot.editMessageText(text, {
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

    await this.sendTyping(bot, chatId);
    void bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  private async showServices(
    bot: TelegramBot,
    chatId: number,
    client: Client,
    lang: Lang,
    messageId?: number,
  ) {
    const services = client.services.filter((s) => s.isActive);

    if (services.length === 0) {
      if (messageId) {
        await bot
          .editMessageText(this.i18n.t('services_empty', lang), {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } else {
        await this.sendTyping(bot, chatId);
        void bot.sendMessage(chatId, this.i18n.t('services_empty', lang));
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
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup,
        });
        return;
      } catch {
        // fall through
      }
    }

    await this.sendTyping(bot, chatId);
    void bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  // ── About (lead: services + Leave Contact CTA) ──────────

  private async showAbout(
    bot: TelegramBot,
    chatId: number,
    client: Client,
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

    await this.sendTyping(bot, chatId);
    void bot.sendMessage(chatId, text, {
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
    bot: TelegramBot,
    chatId: number,
    client: Client,
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

    await this.sendTyping(bot, chatId);
    void bot.sendMessage(chatId, text, {
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
    bot: TelegramBot,
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
      price:
        product.price != null
          ? formatPrice(product.price, client.currency)
          : '',
    });

    const reply_markup = this.ui.productDetailKeyboard(productId, lang);

    if (messageId) {
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup,
        });
        return;
      } catch {
        // fall through
      }
    }

    await this.sendTyping(bot, chatId);
    void bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup,
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Contact
  // ═══════════════════════════════════════════════════════

  private async showContact(bot: TelegramBot, chatId: number) {
    const session = await this.chatService.getSession(chatId);
    if (!session) {
      void bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
      return;
    }

    const lang = (session.lang as Lang) ?? 'en';
    const client = await this.clientService.findOne(session.clientId);
    const botConfig = client.parsedBotConfig;
    await this.sendTyping(bot, chatId);

    void bot.sendMessage(
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

  private async handleMessage(
    bot: TelegramBot,
    binding: BotBinding,
    msg: TelegramBot.Message,
  ) {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;

    try {
      let session = await this.chatService.getSession(chatId);

      // On a per-client bot the clientId is fixed by binding — auto-provision
      // a session if the user started typing before /start.
      if (!session && binding.clientId != null) {
        const client = await this.clientService
          .findOne(binding.clientId)
          .catch(() => null);
        if (client) {
          const lang: Lang = this.i18n.isValidLang(client.defaultLang)
            ? client.defaultLang
            : 'en';
          await this.chatService.setSession(chatId, client.id, lang);
          session = await this.chatService.getSession(chatId);
        }
      }

      if (!session) {
        void bot.sendMessage(chatId, this.i18n.t('use_start', 'en'));
        return;
      }

      const lang = (session.lang as Lang) ?? 'en';
      const text = msg.text.trim();

      // 1️⃣ Active flow — route to current flow handler
      if (this.flowRouter.isInFlow(chatId)) {
        await this.flowRouter.handleMessage(chatId, text, bot, lang);
        return;
      }

      // 2️⃣ Reply-keyboard button press
      if (await this.routeMenuButton(bot, chatId, text, lang)) {
        return;
      }

      // 3️⃣ AI-off guard — when an admin has taken over, skip AI entirely
      //    but still persist the user message (which also broadcasts to admins).
      const client = await this.clientService.findOne(session.clientId);
      if (!session.isAiActive) {
        await this.chatService.addMessage(chatId, client.id, 'user', text);
        return;
      }

      // 4️⃣ Lead-type clients: silently enter lead AI-chat state so every
      //    AI reply includes the "Leave your contact" button for lead capture.
      if (client.type === 'lead') {
        this.flowRouter.initLeadState(chatId, client.id);
        await this.flowRouter.handleMessage(chatId, text, bot, lang);
        return;
      }

      // 5️⃣ Order-type clients: plain AI chat
      await this.handleAiChat(bot, chatId, session, lang, text);
    } catch (err) {
      this.logger.error(
        `handleMessage error — chat ${chatId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      try {
        await bot.sendMessage(chatId, this.i18n.t('error_fallback', 'en'));
      } catch {
        // ignore secondary failure
      }
    }
  }

  // ── Route reply‑keyboard button presses ─────────────────

  private async routeMenuButton(
    bot: TelegramBot,
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
        await this.showProducts(bot, chatId, client, lang);
        return true;
      }
      case 'services': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (!client.hasServices) return false;
        await this.showServices(bot, chatId, client, lang);
        return true;
      }
      case 'order': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type === 'lead' || !client.hasProducts) return false;
        await bot.sendMessage(chatId, this.i18n.t('flow_starting', lang), {
          reply_markup: this.ui.removeKeyboard(),
        });
        await this.flowRouter.startFlow(chatId, client, bot, lang);
        return true;
      }
      case 'about': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type !== 'lead' || !client.hasServices) return false;
        await this.showAbout(bot, chatId, client, lang);
        this.flowRouter.initLeadState(chatId, client.id);
        return true;
      }
      case 'prices': {
        const session = await this.chatService.getSession(chatId);
        if (!session) return false;
        const client = await this.clientService.findOne(session.clientId);
        if (client.type !== 'lead' || !client.hasProducts) return false;
        await this.showPrices(bot, chatId, client, lang);
        this.flowRouter.initLeadState(chatId, client.id);
        return true;
      }
      case 'contact':
        await this.showContact(bot, chatId);
        return true;
      case 'language':
        await this.handleLanguageCommand(bot, chatId);
        return true;
      case 'ai_chat':
        await this.sendTyping(bot, chatId);
        void bot.sendMessage(chatId, this.i18n.t('ai_chat_active', lang), {
          parse_mode: 'Markdown',
        });
        return true;
      default:
        return false;
    }
  }

  // ── AI chat handler (order-type: generic) ───────────────

  private async handleAiChat(
    bot: TelegramBot,
    chatId: number,
    session: { clientId: number; lang: string },
    lang: Lang,
    text: string,
  ) {
    const client = await this.clientService.findOne(session.clientId);
    const systemPrompt = this.clientService.buildPrompt(client, lang);

    void bot.sendChatAction(chatId, 'typing');

    const history = await this.chatService.getRecentHistory(chatId, client.id);
    await this.chatService.addMessage(chatId, client.id, 'user', text);

    const reply = await this.aiService.ask(text, systemPrompt, history, {
      aiProvider: client.aiProvider,
      aiModel: client.aiModel,
    });

    await this.chatService.addMessage(chatId, client.id, 'assistant', reply);

    void bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  }

  // ── Sales AI chat handler (lead-type) ────────────────────

  /**
   * Called by LeadFlowService.handleAiChat — routes the user message through
   * SalesAiService for BANT qualification, then sends the reply with smart
   * intent-based inline buttons.
   */
  async handleSalesAiChat(
    bot: TelegramBot,
    chatId: number,
    clientId: number,
    lang: Lang,
    text: string,
  ): Promise<{
    reply: string;
    session:
      | import('../chat/entities/chat-session.entity.js').ChatSession
      | null;
  }> {
    const client = await this.clientService.findOne(clientId);
    const catalog = this.buildCatalogString(client);

    void bot.sendChatAction(chatId, 'typing');

    const history = await this.chatService.getRecentHistory(chatId, clientId);

    const reply = await this.salesAi.generateSalesReply({
      chatId,
      clientId,
      userMessage: text,
      promptContext: {
        businessName: client.name,
        businessPitch: client.systemPrompt,
        lang: lang as 'uz' | 'ru' | 'en',
        catalog,
      },
      history,
      aiProvider: client.aiProvider,
      aiModel: client.aiModel,
    });

    await this.chatService.addMessage(chatId, clientId, 'assistant', reply);

    // Fetch updated session for smart keyboard
    const updatedSession = await this.chatService.getSession(chatId);

    return { reply, session: updatedSession };
  }

  // ── Smart keyboard builder ──────────────────────────────
  /**
   * Build intent-based inline buttons for lead-type conversations.
   * - HOT lead (score > 80):  📞 Request a Call
   * - High/buying intent:     📋 See Catalog (if client has products/services)
   * - Otherwise:              📝 Leave Contact (always present for leads)
   */
  buildSmartKeyboard(
    session:
      | import('../chat/entities/chat-session.entity.js').ChatSession
      | null,
    lang: Lang,
    hasProducts: boolean,
    hasServices: boolean,
  ): TelegramBot.InlineKeyboardButton[][] {
    const btns: TelegramBot.InlineKeyboardButton[][] = [];

    if (!session) {
      btns.push([
        {
          text: `📝 ${this.i18n.t('btn_leave_contact', lang)}`,
          callback_data: 'flow:leave_contact',
        },
      ]);
      return btns;
    }

    // HOT lead — top-priority CTA
    if (session.score > 80) {
      btns.push([
        {
          text: `📞 ${this.i18n.t('btn_request_call', lang)}`,
          callback_data: 'flow:leave_contact',
        },
      ]);
    } else {
      // Standard leave-contact CTA
      btns.push([
        {
          text: `📝 ${this.i18n.t('btn_leave_contact', lang)}`,
          callback_data: 'flow:leave_contact',
        },
      ]);
    }

    // High-intent: show catalog link
    if (session.score >= 40 && (hasProducts || hasServices)) {
      btns.push([
        {
          text: `📋 ${this.i18n.t('btn_see_catalog', lang)}`,
          callback_data: hasServices ? 'menu:services' : 'menu:products',
        },
      ]);
    }

    return btns;
  }

  // ── Minimal reply keyboard for lead-type (Language + Contact) ─
  private minimalLeadKeyboard(lang: Lang): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: [
        [
          { text: this.i18n.t('btn_language', lang) },
          { text: this.i18n.t('btn_contact', lang) },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  // ── Build catalog string for SalesAiService prompt context ─
  private buildCatalogString(client: Client): string {
    const lines: string[] = [];
    const products = client.products?.filter((p) => p.isActive) ?? [];
    const services = client.services?.filter((s) => s.isActive) ?? [];

    for (const p of products) {
      let line = `• ${p.name}`;
      if (p.price != null)
        line += ` — ${formatPrice(p.price, client.currency)}`;
      if (p.description) line += `: ${p.description}`;
      lines.push(line);
    }
    for (const s of services) {
      let line = `• ${s.name}`;
      if (s.price != null)
        line += ` — ${formatPrice(s.price, client.currency)}`;
      if (s.description) line += `: ${s.description}`;
      lines.push(line);
    }

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════

  /** Simulate typing for a more natural feel */
  private async sendTyping(bot: TelegramBot, chatId: number): Promise<void> {
    void bot.sendChatAction(chatId, 'typing');
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
  private async getClient(chatId: number): Promise<Client | undefined> {
    const session = await this.chatService.getSession(chatId);
    if (!session) return undefined;
    try {
      return await this.clientService.findOne(session.clientId);
    } catch {
      return undefined;
    }
  }

  /** Prefer the bot's binding; fall back to the chat session */
  private async resolveClientId(
    chatId: number,
    binding: BotBinding,
  ): Promise<number | null> {
    if (binding.clientId != null) return binding.clientId;
    const session = await this.chatService.getSession(chatId);
    return session?.clientId ?? null;
  }
}
