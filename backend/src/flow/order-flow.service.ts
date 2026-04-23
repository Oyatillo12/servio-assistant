import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { FlowStateService, OrderStep } from './flow-state.service.js';
import type { CartItem } from './flow-state.service.js';
import { OrderService } from '../order/order.service.js';
import { ClientService } from '../client/client.service.js';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import { NotificationService } from '../notification/notification.service.js';
import type { Product } from '../client/entities/product.entity.js';
import { formatPrice } from '../common/utils/currency.util.js';

@Injectable()
export class OrderFlowService {
  private readonly logger = new Logger(OrderFlowService.name);

  constructor(
    private readonly state: FlowStateService,
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly i18n: I18nService,
    private readonly notificationService: NotificationService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  Start flow
  // ═══════════════════════════════════════════════════════

  async start(
    chatId: number,
    clientId: number,
    bot: TelegramBot,
    lang: Lang,
    productId?: number,
  ): Promise<void> {
    const client = await this.clientService.findOne(clientId);
    const products = client.products.filter((p) => p.isActive);

    if (products.length === 0) {
      await bot.sendMessage(chatId, this.i18n.t('order_no_products', lang));
      return;
    }

    this.state.startFlow(chatId, 'order', OrderStep.SELECT_PRODUCT, clientId);

    if (productId != null) {
      await this.onProductSelected(chatId, productId, bot, lang);
      return;
    }

    const sent = await bot.sendMessage(
      chatId,
      this.i18n.t('order_select_product', lang),
      {
        parse_mode: 'Markdown',
        reply_markup: this.productListKeyboard(products, lang, client.currency),
      },
    );
    this.state.setMessageId(chatId, sent.message_id);
  }

  // ═══════════════════════════════════════════════════════
  //  Handle text messages (quantity, phone, address)
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
        case OrderStep.ENTER_QUANTITY:
          await this.handleQuantity(chatId, text, bot, lang);
          break;
        case OrderStep.ENTER_PHONE:
          await this.handlePhone(chatId, text, bot, lang);
          break;
        case OrderStep.ENTER_ADDRESS:
          await this.handleAddress(chatId, text, bot, lang);
          break;
        default:
          await bot.sendMessage(chatId, this.i18n.t('order_use_buttons', lang));
          break;
      }
    } catch (err) {
      this.logger.error(
        `OrderFlow handleMessage error — chat ${chatId}: ${(err as Error).message}`,
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
        case 'select_product':
          await this.onProductSelected(
            chatId,
            Number(value),
            bot,
            lang,
            messageId,
          );
          break;
        case 'cart':
          await this.showCart(chatId, bot, lang, messageId);
          break;
        case 'cart_remove':
          await this.onCartRemove(chatId, Number(value), bot, lang, messageId);
          break;
        case 'cart_add_more':
          await this.onAddMore(chatId, bot, lang, messageId);
          break;
        case 'cart_checkout':
          await this.onCheckout(chatId, bot, lang, messageId);
          break;
        case 'confirm':
          await this.onConfirm(chatId, bot, lang, messageId);
          break;
        case 'cancel':
          await this.onCancel(chatId, bot, lang, messageId);
          break;
        case 'skip_address':
          await this.onSkipAddress(chatId, bot, lang, messageId);
          break;
        case 'back':
          await this.onBack(chatId, value, bot, lang, messageId);
          break;
        default:
          this.logger.warn(`Unknown order callback: ${data}`);
      }
    } catch (err) {
      this.logger.error(
        `OrderFlow handleCallback error — chat ${chatId}, data "${data}": ${(err as Error).message}`,
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
  //  Step handlers
  // ═══════════════════════════════════════════════════════

  private async onProductSelected(
    chatId: number,
    productId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    const clientId = this.state.getState(chatId)?.clientId;
    if (!clientId) return;

    const client = await this.clientService.findOne(clientId);
    // Only match active products to prevent ordering inactive/deleted items
    const product = client.products.find(
      (p) => p.id === productId && p.isActive,
    );

    if (!product) {
      // Product unavailable — show product list again instead of leaving user stuck
      const products = client.products.filter((p) => p.isActive);
      this.state.setStep(chatId, OrderStep.SELECT_PRODUCT);
      await this.editOrSend(
        chatId,
        bot,
        this.i18n.t('order_select_product', lang),
        this.productListKeyboard(products, lang, client.currency),
        messageId,
      );
      return;
    }

    this.state.updateData(chatId, 'pendingProductId', productId);
    this.state.updateData(chatId, 'pendingProductName', product.name);
    this.state.updateData(chatId, 'pendingProductPrice', product.price);
    this.state.setStep(chatId, OrderStep.ENTER_QUANTITY);

    const text = this.i18n.t('order_enter_quantity', lang, {
      product: product.name,
    });

    // Edit the product-list message → quantity prompt (same message, new content)
    await this.editOrSend(
      chatId,
      bot,
      text,
      this.backCancelKeyboard(lang, 'products'),
      messageId,
    );
  }

  private async handleQuantity(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    const quantity = parseInt(text, 10);

    // Strip old inline buttons — user typed text, old buttons are stale
    await this.state.stripOldButtons(chatId, bot);

    if (isNaN(quantity) || quantity < 1 || quantity > 999) {
      // Send validation error as the new tracked message (not a duplicate)
      const sent = await bot.sendMessage(
        chatId,
        this.i18n.t('order_invalid_quantity', lang),
        {
          parse_mode: 'Markdown',
          reply_markup: this.backCancelKeyboard(lang, 'products'),
        },
      );
      this.state.setMessageId(chatId, sent.message_id);
      return;
    }

    const s = this.state.getState(chatId);
    if (!s) return;

    const item: CartItem = {
      productId: s.data['pendingProductId'] as number,
      productName: s.data['pendingProductName'] as string,
      price: s.data['pendingProductPrice'] as number | null,
      quantity,
    };
    this.state.addToCart(chatId, item);

    this.state.updateData(chatId, 'pendingProductId', undefined);
    this.state.updateData(chatId, 'pendingProductName', undefined);
    this.state.updateData(chatId, 'pendingProductPrice', undefined);

    // Send cart as a fresh message (old message was text-input context)
    await this.showCart(chatId, bot, lang);
  }

  private async showCart(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.setStep(chatId, OrderStep.CART_REVIEW);
    const s = this.state.getState(chatId);
    if (!s) return;
    const client = await this.clientService.findOne(s.clientId);
    const cart = this.state.getCart(chatId);

    if (cart.length === 0) {
      await this.editOrSend(
        chatId,
        bot,
        this.i18n.t('cart_empty', lang),
        this.cartEmptyKeyboard(lang),
        messageId,
      );
      return;
    }

    const lines = cart.map((item, i) => {
      const priceStr =
        item.price != null
          ? ` x ${formatPrice(item.price, client.currency)}`
          : '';
      return `${i + 1}. *${item.productName}* — ${item.quantity}${priceStr}`;
    });

    const total = this.calculateTotal(cart);
    const totalLine =
      total > 0
        ? `\n💰 ${this.i18n.t('cart_total', lang)}: *${formatPrice(total, client.currency)}*`
        : '';

    const text = `🛒 ${this.i18n.t('cart_title', lang)}\n\n${lines.join('\n')}${totalLine}`;

    await this.editOrSend(
      chatId,
      bot,
      text,
      this.cartKeyboard(cart, lang),
      messageId,
    );
  }

  private async onCartRemove(
    chatId: number,
    productId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.removeFromCart(chatId, productId);
    await this.showCart(chatId, bot, lang, messageId);
  }

  private async onAddMore(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    const clientId = this.state.getState(chatId)?.clientId;
    if (!clientId) return;

    const client = await this.clientService.findOne(clientId);
    const products = client.products.filter((p) => p.isActive);
    this.state.setStep(chatId, OrderStep.SELECT_PRODUCT);

    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('order_select_product', lang),
      this.productListKeyboard(products, lang, client.currency),
      messageId,
    );
  }

  private async onCheckout(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    const cart = this.state.getCart(chatId);
    if (cart.length === 0) return;

    this.state.setStep(chatId, OrderStep.ENTER_PHONE);

    // Edit the cart message → phone prompt
    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('order_enter_phone', lang),
      this.backCancelKeyboard(lang, 'cart'),
      messageId,
    );
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
        this.i18n.t('order_invalid_phone', lang),
        {
          parse_mode: 'Markdown',
          reply_markup: this.backCancelKeyboard(lang, 'cart'),
        },
      );
      this.state.setMessageId(chatId, sent.message_id);
      return;
    }

    this.state.updateData(chatId, 'phone', phone);
    this.state.setStep(chatId, OrderStep.ENTER_ADDRESS);

    // Send address prompt as a clean new message
    const sent = await bot.sendMessage(
      chatId,
      this.i18n.t('order_enter_address', lang),
      {
        parse_mode: 'Markdown',
        reply_markup: this.skipBackCancelKeyboard(lang, 'phone'),
      },
    );
    this.state.setMessageId(chatId, sent.message_id);
  }

  private async handleAddress(
    chatId: number,
    text: string,
    bot: TelegramBot,
    lang: Lang,
  ): Promise<void> {
    // Strip stale buttons from the "enter address" prompt
    await this.state.stripOldButtons(chatId, bot);

    this.state.updateData(chatId, 'address', text.trim());
    await this.showSummary(chatId, bot, lang);
  }

  private async onSkipAddress(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.updateData(chatId, 'address', null);
    await this.showSummary(chatId, bot, lang, messageId);
  }

  private async showSummary(
    chatId: number,
    bot: TelegramBot,
    lang: Lang,
    messageId?: number,
  ): Promise<void> {
    this.state.setStep(chatId, OrderStep.CONFIRM);

    const s = this.state.getState(chatId);
    if (!s) return;
    const client = await this.clientService.findOne(s.clientId);

    const cart = s.cart;
    const address = s.data['address'] as string | null;

    const itemLines = cart.map((item) => {
      const priceStr =
        item.price != null
          ? ` x ${formatPrice(item.price, client.currency)}`
          : '';
      return `  • ${item.productName} — ${item.quantity}${priceStr}`;
    });

    const total = this.calculateTotal(cart);
    const totalLine =
      total > 0
        ? `\n💰 ${this.i18n.t('cart_total', lang)}: *${formatPrice(total, client.currency)}*`
        : '';

    const text = this.i18n.t('order_summary', lang, {
      items: itemLines.join('\n'),
      phone: (s.data['phone'] as string) ?? '—',
      address: address || this.i18n.t('order_address_skipped', lang),
      total: totalLine,
    });

    // Try editing the skip-address button message, otherwise send new
    await this.editOrSend(
      chatId,
      bot,
      text,
      this.confirmCancelKeyboard(lang),
      messageId,
    );
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

    const order = await this.orderService.create({
      chatId,
      clientId: s.clientId,
      phone: (s.data['phone'] as string) ?? '',
      address: (s.data['address'] as string) ?? undefined,
      items: s.cart.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        price: c.price,
        quantity: c.quantity,
      })),
    });

    this.state.clearState(chatId);

    const client = await this.clientService.findOne(s.clientId);
    await this.notificationService.notifyNewOrder(bot, client, order, lang);

    this.logger.log(`Order #${order.id} confirmed — chat ${chatId}`);

    // Edit the summary message → confirmation
    await this.editOrSend(
      chatId,
      bot,
      this.i18n.t('order_confirmed', lang),
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
      this.i18n.t('order_cancelled', lang),
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
      case 'products': {
        const clientId = this.state.getState(chatId)?.clientId;
        if (!clientId) return;
        const client = await this.clientService.findOne(clientId);
        const products = client.products.filter((p) => p.isActive);

        // Always go back to the product list — the user pressed Back to choose a product
        this.state.setStep(chatId, OrderStep.SELECT_PRODUCT);
        await this.editOrSend(
          chatId,
          bot,
          this.i18n.t('order_select_product', lang),
          this.productListKeyboard(products, lang, client.currency),
          messageId,
        );
        break;
      }
      case 'cart':
        await this.showCart(chatId, bot, lang, messageId);
        break;
      case 'phone':
        this.state.setStep(chatId, OrderStep.ENTER_PHONE);
        await this.editOrSend(
          chatId,
          bot,
          this.i18n.t('order_enter_phone', lang),
          this.backCancelKeyboard(lang, 'cart'),
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

  private productListKeyboard(
    products: Product[],
    lang: Lang,
    currency: string = 'USD',
  ): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = products.map((p) => [
      {
        text: `${p.name}${p.price != null ? ` — ${formatPrice(p.price, currency)}` : ''}`,
        callback_data: `flow:select_product:${p.id}`,
      },
    ]);
    rows.push([
      {
        text: `❌ ${this.i18n.t('btn_cancel', lang)}`,
        callback_data: 'flow:cancel',
      },
    ]);
    return { inline_keyboard: rows };
  }

  private cartKeyboard(
    cart: CartItem[],
    lang: Lang,
  ): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = [];

    for (const item of cart) {
      rows.push([
        {
          text: `🗑 ${item.productName}`,
          callback_data: `flow:cart_remove:${item.productId}`,
        },
      ]);
    }

    rows.push([
      {
        text: `➕ ${this.i18n.t('btn_add_more', lang)}`,
        callback_data: 'flow:cart_add_more',
      },
    ]);
    rows.push([
      {
        text: `✅ ${this.i18n.t('btn_checkout', lang)}`,
        callback_data: 'flow:cart_checkout',
      },
      {
        text: `❌ ${this.i18n.t('btn_cancel', lang)}`,
        callback_data: 'flow:cancel',
      },
    ]);

    return { inline_keyboard: rows };
  }

  private cartEmptyKeyboard(lang: Lang): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `➕ ${this.i18n.t('btn_add_more', lang)}`,
            callback_data: 'flow:cart_add_more',
          },
          {
            text: `❌ ${this.i18n.t('btn_cancel', lang)}`,
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

  private skipBackCancelKeyboard(
    lang: Lang,
    backTarget: string,
  ): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `⏭ ${this.i18n.t('btn_skip', lang)}`,
            callback_data: 'flow:skip_address',
          },
        ],
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

  private calculateTotal(cart: CartItem[]): number {
    return cart.reduce((sum, item) => {
      if (item.price != null) return sum + item.price * item.quantity;
      return sum;
    }, 0);
  }

  /**
   * Edit the existing message if possible, otherwise send a new one.
   * This keeps the chat clean by reusing messages.
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
        // Edit failed — fall through to send new message
      }
    }

    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
    this.state.setMessageId(chatId, sent.message_id);
  }
}
