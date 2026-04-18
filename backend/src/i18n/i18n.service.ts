import { Injectable } from '@nestjs/common';

export type Lang = 'uz' | 'ru' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  // ── General ─────────────────────────────────────────────
  welcome: {
    uz: 'Assalomu alaykum! Sizga qanday yordam bera olaman?',
    ru: 'Здравствуйте! Чем могу помочь?',
    en: 'Hello! How can I help you?',
  },
  welcome_connected: {
    uz: '✅ *{name}* ga ulandingiz!\n\n🏪 Quyidagi menyu orqali xizmatlarimiz bilan tanishing.\nYoki menga savolingizni yuboring 💬',
    ru: '✅ Вы подключены к *{name}*!\n\n🏪 Используйте меню ниже для навигации.\nИли просто задайте вопрос 💬',
    en: '✅ Connected to *{name}*!\n\n🏪 Use the menu below to explore.\nOr just send me a question 💬',
  },
  unknown_provider: {
    uz: 'Noaniq provayder. Iltimos, havolani tekshiring.',
    ru: 'Неизвестный провайдер. Проверьте ссылку.',
    en: 'Unknown provider. Please check your link.',
  },
  use_start: {
    uz: 'Iltimos, avval provayder havolasi orqali /start bosing.',
    ru: 'Сначала используйте /start со ссылкой провайдера.',
    en: 'Please use /start with your provider link first.',
  },
  choose_language: {
    uz: '🌐 Tilni tanlang:',
    ru: '🌐 Выберите язык:',
    en: '🌐 Choose your language:',
  },
  language_set: {
    uz: "✅ Til o'zbekcha qilib o'rnatildi",
    ru: '✅ Язык установлен: Русский',
    en: '✅ Language set to English',
  },
  error_fallback: {
    uz: "❌ Kechirasiz, xatolik yuz berdi.\nIltimos, keyinroq urinib ko'ring.",
    ru: '❌ Извините, произошла ошибка.\nПопробуйте позже.',
    en: '❌ Sorry, something went wrong.\nPlease try again later.',
  },
  ai_empty: {
    uz: "Javob yaratib bo'lmadi. Iltimos, qayta urinib ko'ring.",
    ru: 'Не удалось сгенерировать ответ. Попробуйте снова.',
    en: 'Could not generate a response. Please try again.',
  },

  // ── Main menu button labels ─────────────────────────────
  btn_products: {
    uz: '🛍 Mahsulotlar',
    ru: '🛍 Продукты',
    en: '🛍 Products',
  },
  btn_services: {
    uz: '🛠 Xizmatlar',
    ru: '🛠 Услуги',
    en: '🛠 Services',
  },
  btn_order: {
    uz: '📦 Buyurtma',
    ru: '📦 Заказ',
    en: '📦 Order',
  },
  btn_contact: {
    uz: '📞 Aloqa',
    ru: '📞 Контакты',
    en: '📞 Contact',
  },
  btn_language: {
    uz: '🌐 Til',
    ru: '🌐 Язык',
    en: '🌐 Language',
  },
  btn_ai_chat: {
    uz: '🤖 AI Chat',
    ru: '🤖 AI Чат',
    en: '🤖 AI Chat',
  },
  btn_about: {
    uz: 'ℹ️ Biz haqimizda',
    ru: 'ℹ️ О нас / Услуги',
    en: 'ℹ️ About / Services',
  },
  btn_prices: {
    uz: '💰 Narxlar',
    ru: '💰 Цены',
    en: '💰 Prices',
  },

  // ── Inline button labels ────────────────────────────────
  btn_back: {
    uz: 'Orqaga',
    ru: 'Назад',
    en: 'Back',
  },
  btn_order_now: {
    uz: 'Buyurtma berish',
    ru: 'Заказать',
    en: 'Order now',
  },
  btn_confirm: {
    uz: 'Tasdiqlash',
    ru: 'Подтвердить',
    en: 'Confirm',
  },
  btn_cancel: {
    uz: 'Bekor qilish',
    ru: 'Отменить',
    en: 'Cancel',
  },
  btn_call: {
    uz: "Qo'ng'iroq qilish",
    ru: 'Позвонить',
    en: 'Call us',
  },
  btn_website: {
    uz: 'Veb-sayt',
    ru: 'Веб-сайт',
    en: 'Website',
  },
  btn_copy: {
    uz: 'Nusxa olish',
    ru: 'Скопировать',
    en: 'Copy',
  },

  // ── Products ────────────────────────────────────────────
  products_title: {
    uz: '🛍 *Mahsulotlar*\n\nTanlang:',
    ru: '🛍 *Продукты*\n\nВыберите:',
    en: '🛍 *Products*\n\nChoose a product:',
  },
  products_empty: {
    uz: "📋 Hozircha mahsulotlar yo'q.",
    ru: '📋 Пока нет продуктов.',
    en: '📋 No products available yet.',
  },
  product_detail: {
    uz: '📦 *{name}*\n\n{description}\n\n💰 Narxi: *${price}*',
    ru: '📦 *{name}*\n\n{description}\n\n💰 Цена: *${price}*',
    en: '📦 *{name}*\n\n{description}\n\n💰 Price: *${price}*',
  },
  product_detail_no_price: {
    uz: '📦 *{name}*\n\n{description}\n\n💰 Narxi: Aloqa qiling',
    ru: '📦 *{name}*\n\n{description}\n\n💰 Цена: По запросу',
    en: '📦 *{name}*\n\n{description}\n\n💰 Price: Contact us',
  },

  // ── Services ────────────────────────────────────────────
  services_title: {
    uz: '🛠 *Xizmatlar*\n\n',
    ru: '🛠 *Услуги*\n\n',
    en: '🛠 *Services*\n\n',
  },
  services_empty: {
    uz: "📋 Hozircha xizmatlar yo'q.",
    ru: '📋 Пока нет услуг.',
    en: '📋 No services available yet.',
  },
  prices_title: {
    uz: '💰 *Narxlar*\n\n',
    ru: '💰 *Цены*\n\n',
    en: '💰 *Prices*\n\n',
  },
  prices_empty: {
    uz: "💰 Narxlar haqida batafsil ma'lumot olish uchun bizga murojaat qiling.",
    ru: '💰 Для получения подробной информации о ценах, свяжитесь с нами.',
    en: '💰 For detailed pricing information, please contact us.',
  },

  // ── Contact ─────────────────────────────────────────────
  contact_title: {
    uz: "📞 *Biz bilan aloqa*\n\nQuyidagi usullar orqali bog'lanishingiz mumkin:",
    ru: '📞 *Свяжитесь с нами*\n\nВы можете связаться с нами:',
    en: '📞 *Contact Us*\n\nReach out through the options below:',
  },

  // ── Order flow ──────────────────────────────────────────
  order_select_product: {
    uz: '📦 *Buyurtma berish*\n\nQaysi mahsulotni buyurtma qilmoqchisiz?',
    ru: '📦 *Оформление заказа*\n\nКакой продукт хотите заказать?',
    en: '📦 *Place an Order*\n\nWhich product would you like to order?',
  },
  order_enter_quantity: {
    uz: '🔢 *{product}* uchun miqdorni kiriting:',
    ru: '🔢 Введите количество для *{product}*:',
    en: '🔢 Enter quantity for *{product}*:',
  },
  order_summary: {
    uz: '📋 *Buyurtma tafsilotlari*\n\n🛒 Savatcha:\n{items}\n{total}\n📱 Telefon: *{phone}*\n📍 Manzil: *{address}*\n\nTasdiqlaysizmi?',
    ru: '📋 *Детали заказа*\n\n🛒 Корзина:\n{items}\n{total}\n📱 Телефон: *{phone}*\n📍 Адрес: *{address}*\n\nПодтверждаете?',
    en: '📋 *Order Summary*\n\n🛒 Cart:\n{items}\n{total}\n📱 Phone: *{phone}*\n📍 Address: *{address}*\n\nConfirm your order?',
  },
  order_confirmed: {
    uz: "✅ *Buyurtma qabul qilindi!*\n\nTez orada siz bilan bog'lanamiz. Rahmat! 🙏",
    ru: '✅ *Заказ принят!*\n\nМы свяжемся с вами в ближайшее время. Спасибо! 🙏',
    en: "✅ *Order confirmed!*\n\nWe'll get back to you shortly. Thank you! 🙏",
  },
  order_cancelled: {
    uz: '❌ Buyurtma bekor qilindi.\nAsosiy menyuga qaytdingiz.',
    ru: '❌ Заказ отменён.\nВы вернулись в главное меню.',
    en: "❌ Order cancelled.\nYou're back to the main menu.",
  },
  order_invalid_quantity: {
    uz: "⚠️ Iltimos, to'g'ri son kiriting (1-999):",
    ru: '⚠️ Пожалуйста, введите корректное число (1-999):',
    en: '⚠️ Please enter a valid number (1-999):',
  },
  order_no_products: {
    uz: '📋 Buyurtma berish uchun mahsulotlar mavjud emas.',
    ru: '📋 Нет доступных продуктов для заказа.',
    en: '📋 No products available to order.',
  },

  // ── Cart ────────────────────────────────────────────────
  cart_title: {
    uz: '*Savatchangiz*',
    ru: '*Ваша корзина*',
    en: '*Your Cart*',
  },
  cart_empty: {
    uz: "🛒 Savatcha bo'sh.",
    ru: '🛒 Корзина пуста.',
    en: '🛒 Your cart is empty.',
  },
  cart_total: {
    uz: 'Jami',
    ru: 'Итого',
    en: 'Total',
  },
  btn_add_more: {
    uz: "Yana qo'shish",
    ru: 'Добавить ещё',
    en: 'Add more',
  },
  btn_checkout: {
    uz: 'Buyurtma berish',
    ru: 'Оформить заказ',
    en: 'Checkout',
  },

  flow_starting: {
    uz: '⏳ Jarayon boshlanmoqda...',
    ru: '⏳ Начинаем...',
    en: '⏳ Starting...',
  },
  flow_expired: {
    uz: '⏱ Sessiya muddati tugadi.\nIltimos, asosiy menyudan qaytadan boshlang.',
    ru: '⏱ Сессия истекла.\nПожалуйста, начните заново из главного меню.',
    en: '⏱ Your session has expired.\nPlease start again from the main menu.',
  },

  // ── Fallback / unknown ──────────────────────────────────
  fallback: {
    uz: '🤔 Tushunmadim.\n\nQuyidagilardan birini tanlang yoki savolingizni yozing:',
    ru: '🤔 Не понял.\n\nВыберите пункт меню или задайте вопрос:',
    en: "🤔 I didn't quite get that.\n\nPick an option from the menu or type your question:",
  },
  main_menu: {
    uz: '🏠 Asosiy menyu',
    ru: '🏠 Главное меню',
    en: '🏠 Main menu',
  },

  // ── AI chat mode ────────────────────────────────────────
  ai_chat_active: {
    uz: '🤖 *AI Chat rejimi faol*\n\nMenga savolingizni yuboring.\nMenyuga qaytish uchun tugmalardan foydalaning.',
    ru: '🤖 *AI Чат активен*\n\nЗадайте мне вопрос.\nИспользуйте кнопки для возврата в меню.',
    en: '🤖 *AI Chat mode active*\n\nSend me your question.\nUse the menu buttons to navigate back.',
  },

  // ── Order flow (extended) ───────────────────────────────
  order_enter_phone: {
    uz: '📱 Telefon raqamingizni kiriting:',
    ru: '📱 Введите номер телефона:',
    en: '📱 Enter your phone number:',
  },
  order_invalid_phone: {
    uz: "⚠️ Iltimos, telefon raqamini to'g'ri kiriting:",
    ru: '⚠️ Пожалуйста, введите корректный номер:',
    en: '⚠️ Please enter a valid phone number:',
  },
  order_enter_address: {
    uz: "📍 Manzilingizni kiriting yoki o'tkazib yuboring:",
    ru: '📍 Введите адрес или пропустите:',
    en: '📍 Enter your delivery address or skip:',
  },
  order_address_skipped: {
    uz: "Ko'rsatilmagan",
    ru: 'Не указан',
    en: 'Not provided',
  },
  order_use_buttons: {
    uz: '👆 Iltimos, yuqoridagi tugmalardan foydalaning.',
    ru: '👆 Пожалуйста, используйте кнопки выше.',
    en: '👆 Please use the buttons above.',
  },

  // ── Lead flow ───────────────────────────────────────────
  lead_welcome: {
    uz: '🤖 *AI yordamchisi faol*\n\nMenga savolingizni yuboring.\nKontakt qoldirish uchun tugmani bosing.',
    ru: '🤖 *AI помощник активен*\n\nЗадайте свой вопрос.\nНажмите кнопку, чтобы оставить контакт.',
    en: '🤖 *AI Assistant active*\n\nAsk me your question.\nPress the button to leave your contact.',
  },
  lead_enter_name: {
    uz: '👤 Ismingizni kiriting:',
    ru: '👤 Введите ваше имя:',
    en: '👤 Enter your name:',
  },
  lead_invalid_name: {
    uz: '⚠️ Iltimos, kamida 2 ta belgi kiriting:',
    ru: '⚠️ Пожалуйста, введите минимум 2 символа:',
    en: '⚠️ Please enter at least 2 characters:',
  },
  lead_enter_phone: {
    uz: '📱 Telefon raqamingizni kiriting:',
    ru: '📱 Введите номер телефона:',
    en: '📱 Enter your phone number:',
  },
  lead_invalid_phone: {
    uz: "⚠️ Iltimos, telefon raqamini to'g'ri kiriting:",
    ru: '⚠️ Пожалуйста, введите корректный номер:',
    en: '⚠️ Please enter a valid phone number:',
  },
  lead_summary: {
    uz: "📋 *Ma'lumotlaringiz*\n\n👤 Ism: *{name}*\n📱 Telefon: *{phone}*\n\nTasdiqlaysizmi?",
    ru: '📋 *Ваши данные*\n\n👤 Имя: *{name}*\n📱 Телефон: *{phone}*\n\nПодтверждаете?',
    en: '📋 *Your Details*\n\n👤 Name: *{name}*\n📱 Phone: *{phone}*\n\nConfirm submission?',
  },
  lead_saved: {
    uz: "✅ *Ma'lumotlaringiz qabul qilindi!*\n\nTez orada siz bilan bog'lanamiz. Rahmat! 🙏",
    ru: '✅ *Ваши данные приняты!*\n\nМы свяжемся с вами в ближайшее время. Спасибо! 🙏',
    en: "✅ *Your info has been saved!*\n\nWe'll get back to you shortly. Thank you! 🙏",
  },
  lead_cancelled: {
    uz: '❌ Bekor qilindi.\nAsosiy menyuga qaytdingiz.',
    ru: '❌ Отменено.\nВы вернулись в главное меню.',
    en: "❌ Cancelled.\nYou're back to the main menu.",
  },
  lead_back_to_chat: {
    uz: '🤖 AI yordamchisiga qaytdingiz.\nSavolingizni yuboring.',
    ru: '🤖 Вы вернулись к AI помощнику.\nЗадайте вопрос.',
    en: '🤖 Back to AI assistant.\nSend your question.',
  },
  lead_use_buttons: {
    uz: '👆 Iltimos, yuqoridagi tugmalardan foydalaning.',
    ru: '👆 Пожалуйста, используйте кнопки выше.',
    en: '👆 Please use the buttons above.',
  },

  // ── Button labels (new) ─────────────────────────────────
  btn_skip: {
    uz: "O'tkazib yuborish",
    ru: 'Пропустить',
    en: 'Skip',
  },
  btn_leave_contact: {
    uz: 'Kontakt qoldirish',
    ru: 'Оставить контакт',
    en: 'Leave your contact',
  },
  btn_main_menu: {
    uz: 'Asosiy menyu',
    ru: 'Главное меню',
    en: 'Main menu',
  },

  // ── Admin notifications ─────────────────────────────────
  admin_new_order: {
    uz: '🛒 *Yangi buyurtma #{orderId}*\n\n🏪 Klient: {clientName}\n\n🛒 Savatcha:\n{items}\n\n📱 Telefon: {phone}\n📍 Manzil: {address}',
    ru: '🛒 *Новый заказ #{orderId}*\n\n🏪 Клиент: {clientName}\n\n🛒 Корзина:\n{items}\n\n📱 Телефон: {phone}\n📍 Адрес: {address}',
    en: '🛒 *New Order #{orderId}*\n\n🏪 Client: {clientName}\n\n🛒 Cart:\n{items}\n\n📱 Phone: {phone}\n📍 Address: {address}',
  },
  admin_new_lead: {
    uz: '📋 *Yangi lid #{leadId}*\n\n🏪 Klient: {clientName}\n👤 Ism: {name}\n📱 Telefon: {phone}\n📝 Izoh: {notes}',
    ru: '📋 *Новый лид #{leadId}*\n\n🏪 Клиент: {clientName}\n👤 Имя: {name}\n📱 Телефон: {phone}\n📝 Заметка: {notes}',
    en: '📋 *New Lead #{leadId}*\n\n🏪 Client: {clientName}\n👤 Name: {name}\n📱 Phone: {phone}\n📝 Notes: {notes}',
  },
};

@Injectable()
export class I18nService {
  t(key: string, lang = 'en', vars?: Record<string, string>): string {
    const validLang: Lang = this.isValidLang(lang) ? lang : 'en';
    let text = translations[key]?.[validLang] ?? translations[key]?.en ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, v);
      }
    }
    return text;
  }

  isValidLang(lang: string): lang is Lang {
    return ['uz', 'ru', 'en'].includes(lang);
  }

  /** Get all button labels for matching reply keyboard text */
  getMenuLabels(lang: Lang): Record<string, string> {
    return {
      products: this.t('btn_products', lang),
      services: this.t('btn_services', lang),
      order: this.t('btn_order', lang),
      contact: this.t('btn_contact', lang),
      language: this.t('btn_language', lang),
      ai_chat: this.t('btn_ai_chat', lang),
      about: this.t('btn_about', lang),
      prices: this.t('btn_prices', lang),
    };
  }
}
