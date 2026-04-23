import { Injectable } from '@nestjs/common';
import type TelegramBot from 'node-telegram-bot-api';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import type { Product } from '../client/entities/product.entity.js';
import type { BotConfig } from '../client/entities/client.entity.js';
import { formatPrice, type Currency } from '../common/utils/currency.util.js';

/** Default icons for each menu button */
const DEFAULT_ICONS: Record<string, string> = {
  products: '🛍',
  services: '🛠',
  order: '📦',
  contact: '📞',
  language: '🌐',
  aiChat: '🤖',
  about: 'ℹ️',
  prices: '💰',
};

@Injectable()
export class BotUiService {
  constructor(private readonly i18n: I18nService) {}

  /** Get the icon for a button, using client's custom icon or default */
  private getIcon(key: string, config?: BotConfig): string {
    return (
      config?.buttonIcons?.[key as keyof BotConfig['buttonIcons']] ??
      DEFAULT_ICONS[key] ??
      ''
    );
  }

  // ── Main menu (ReplyKeyboard) ───────────────────────────
  mainMenuKeyboard(
    lang: Lang,
    config?: BotConfig,
    clientType?: 'order' | 'lead',
    hasProducts = true,
    hasServices = true,
  ): TelegramBot.ReplyKeyboardMarkup {
    const btns = config?.menuButtons ?? {};

    // Lead clients: Prices shown only if products feature is on, About shown only if services feature is on
    const buttonDefs: Array<{
      key: string;
      i18nKey: string;
      enabled: boolean;
    }> =
      clientType === 'lead'
        ? [
            {
              key: 'about',
              i18nKey: 'btn_about',
              enabled: hasServices && btns.about !== false,
            },
            {
              key: 'prices',
              i18nKey: 'btn_prices',
              enabled: hasProducts && btns.prices !== false,
            },
            {
              key: 'contact',
              i18nKey: 'btn_contact',
              enabled: btns.contact !== false,
            },
            {
              key: 'language',
              i18nKey: 'btn_language',
              enabled: btns.language !== false,
            },
          ]
        : [
            {
              key: 'products',
              i18nKey: 'btn_products',
              enabled: hasProducts && btns.products !== false,
            },
            {
              key: 'services',
              i18nKey: 'btn_services',
              enabled: hasServices && btns.services !== false,
            },
            {
              // Order button only makes sense when products exist
              key: 'order',
              i18nKey: 'btn_order',
              enabled: hasProducts && btns.order !== false,
            },
            {
              key: 'contact',
              i18nKey: 'btn_contact',
              enabled: btns.contact !== false,
            },
            {
              key: 'language',
              i18nKey: 'btn_language',
              enabled: btns.language !== false,
            },
            {
              key: 'aiChat',
              i18nKey: 'btn_ai_chat',
              enabled: btns.aiChat !== false,
            },
          ];

    const activeButtons = buttonDefs
      .filter((b) => b.enabled)
      .map((b) => {
        const icon = this.getIcon(b.key, config);
        const label = this.i18n.t(b.i18nKey, lang);
        // Replace the default icon in the translation with the custom one
        const defaultIcon = DEFAULT_ICONS[b.key];
        if (icon !== defaultIcon && label.startsWith(defaultIcon)) {
          return { text: icon + label.slice(defaultIcon.length) };
        }
        return { text: label };
      });

    // Arrange in rows of 2
    const keyboard: TelegramBot.KeyboardButton[][] = [];
    for (let i = 0; i < activeButtons.length; i += 2) {
      const row = [activeButtons[i]];
      if (activeButtons[i + 1]) row.push(activeButtons[i + 1]);
      keyboard.push(row);
    }

    return {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }

  // ── Inline: product list ────────────────────────────────
  productListKeyboard(
    products: Product[],
    lang: Lang,
    currency: Currency = 'USD',
  ): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = products.map((p) => [
      {
        text: `${p.name}${p.price != null ? ` — ${formatPrice(p.price, currency)}` : ''}`,
        callback_data: `product:${p.id}`,
      },
    ]);
    rows.push([
      { text: this.i18n.t('btn_back', lang), callback_data: 'nav:main' },
    ]);
    return { inline_keyboard: rows };
  }

  // ── Inline: single product detail ───────────────────────
  productDetailKeyboard(
    productId: number,
    lang: Lang,
  ): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: `📦 ${this.i18n.t('btn_order_now', lang)}`,
            callback_data: `order_product:${productId}`,
          },
        ],
        [
          {
            text: `◀️ ${this.i18n.t('btn_back', lang)}`,
            callback_data: 'menu:products',
          },
        ],
      ],
    };
  }

  // ── Inline: contact options ─────────────────────────────
  contactKeyboard(
    lang: Lang,
    phone?: string,
    website?: string,
  ): TelegramBot.InlineKeyboardMarkup {
    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    if (phone) {
      rows.push([
        {
          text: `${this.i18n.t('btn_copy', lang)}`,
          copy_text: {
            text: phone,
          },
          // url: `tel:${phone}`, --- doesn't work in Telegram, so we just show the number in the text
          // url: `https://wa.me/${phone.replace(/\D/g, '')}`,
        },
      ]);
    }
    if (website) {
      rows.push([
        { text: `🌐 ${this.i18n.t('btn_website', lang)}`, url: website },
      ]);
    }
    rows.push([
      {
        text: `◀️ ${this.i18n.t('btn_back', lang)}`,
        callback_data: 'nav:main',
      },
    ]);
    return { inline_keyboard: rows };
  }

  // ── Inline: language picker ─────────────────────────────
  languageKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: "🇺🇿 O'zbek", callback_data: 'lang:uz' },
          { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
          { text: '🇬🇧 English', callback_data: 'lang:en' },
        ],
      ],
    };
  }

  // ── Remove keyboard helper ──────────────────────────────
  removeKeyboard(): TelegramBot.ReplyKeyboardRemove {
    return { remove_keyboard: true };
  }
}
