/**
 * Demo seed presets — used to one-click provision a realistic demo client.
 * Keep presets complete enough to show the full flow end-to-end
 * (welcome → browse → order/leave contact) without any extra setup.
 */

export type DemoType = 'order' | 'lead';
export type DemoLang = 'uz' | 'ru' | 'en';

export interface DemoProduct {
  name: string;
  description: string;
  price: number | null;
  isActive: boolean;
}

export interface DemoService {
  name: string;
  description: string;
  isActive: boolean;
}

export interface DemoPreset {
  name: string;
  systemPrompt: string;
  welcomeMessage: string;
  currency: 'UZS' | 'USD' | 'RUB';
  products: DemoProduct[];
  services: DemoService[];
}

// ═══════════════════════════════════════════════════════════
//  Order preset: Pizza restaurant
// ═══════════════════════════════════════════════════════════

const orderPreset: Record<DemoLang, DemoPreset> = {
  en: {
    name: 'Demo Pizza Place',
    systemPrompt:
      "You are a friendly assistant for a pizza restaurant. Help customers choose pizzas, answer questions about ingredients, delivery, and opening hours. Be concise, warm, and proactive about suggesting the Order button when a customer shows interest.",
    welcomeMessage:
      "🍕 *Welcome to Demo Pizza Place!*\n\nWe serve fresh, hand-made pizzas daily.\nTap *Order* to start a delivery, or ask me anything.",
    currency: 'USD',
    products: [
      { name: 'Margherita', description: 'Tomato, mozzarella, fresh basil', price: 12, isActive: true },
      { name: 'Pepperoni', description: 'Classic pepperoni with mozzarella', price: 14, isActive: true },
      { name: 'Four Cheese', description: 'Mozzarella, gorgonzola, parmesan, fontina', price: 15, isActive: true },
      { name: 'Veggie Supreme', description: 'Bell peppers, onions, mushrooms, olives', price: 13, isActive: true },
    ],
    services: [
      { name: 'Free delivery', description: 'Free delivery on orders over $25 within 5km', isActive: true },
      { name: 'Gluten-free base', description: 'Available on any pizza (+$2)', isActive: true },
    ],
  },
  ru: {
    name: 'Demo Пиццерия',
    systemPrompt:
      'Ты дружелюбный ассистент пиццерии. Помогай клиентам выбрать пиццу, отвечай на вопросы о составе, доставке и часах работы. Будь краток, приветлив и предлагай кнопку *Заказ*, когда клиент заинтересован.',
    welcomeMessage:
      '🍕 *Добро пожаловать в Demo Пиццерию!*\n\nСвежая пицца ручной работы каждый день.\nНажмите *Заказ* для доставки или задайте вопрос.',
    currency: 'RUB',
    products: [
      { name: 'Маргарита', description: 'Томаты, моцарелла, свежий базилик', price: 350, isActive: true },
      { name: 'Пепперони', description: 'Классическая с пепперони и моцареллой', price: 420, isActive: true },
      { name: 'Четыре сыра', description: 'Моцарелла, горгонзола, пармезан, фонтина', price: 490, isActive: true },
      { name: 'Овощная', description: 'Перец, лук, грибы, оливки', price: 380, isActive: true },
    ],
    services: [
      { name: 'Бесплатная доставка', description: 'Бесплатно при заказе от 1000₽ в радиусе 5км', isActive: true },
      { name: 'Безглютеновая основа', description: 'Доступна для любой пиццы (+60₽)', isActive: true },
    ],
  },
  uz: {
    name: 'Demo Pitseriya',
    systemPrompt:
      "Siz pitseriyaning do'stona yordamchisisiz. Mijozlarga pitsa tanlashga yordam bering, tarkibi, yetkazib berish va ish vaqti haqida savollarga javob bering. Qisqa, samimiy va mijoz qiziqsa *Buyurtma* tugmasini taklif qiling.",
    welcomeMessage:
      "🍕 *Demo Pitseriyaga xush kelibsiz!*\n\nHar kuni yangi, qo'lda tayyorlangan pitsalar.\nYetkazib berish uchun *Buyurtma*ni bosing yoki savol bering.",
    currency: 'UZS',
    products: [
      { name: 'Margarita', description: "Pomidor, motsarella, rayhon", price: 55000, isActive: true },
      { name: 'Pepperoni', description: "Klassik pepperoni va motsarella", price: 75000, isActive: true },
      { name: 'Four Cheese', description: "Motsarella, gorgonzola, parmezan, fontina", price: 85000, isActive: true },
      { name: 'Sabzavotli', description: "Qalampir, piyoz, qo'ziqorin, zaytun", price: 65000, isActive: true },
    ],
    services: [
      { name: 'Bepul yetkazib berish', description: "5km radiusda 150,000 so'mdan yuqori buyurtmalar uchun", isActive: true },
      { name: "Glutensiz xamir", description: "Har qanday pitsaga (+10,000 so'm)", isActive: true },
    ],
  },
};

// ═══════════════════════════════════════════════════════════
//  Lead preset: Dental clinic
// ═══════════════════════════════════════════════════════════

const leadPreset: Record<DemoLang, DemoPreset> = {
  en: {
    name: 'Demo Dental Clinic',
    systemPrompt:
      "You are an assistant for a dental clinic. Answer patient questions about procedures, pricing, and appointment availability. After helping, gently suggest leaving a contact so a specialist can call back. Never diagnose — always recommend booking a consultation.",
    welcomeMessage:
      "🦷 *Welcome to Demo Dental Clinic*\n\nModern care, gentle hands.\nAsk me anything — I'll answer and help you book a free consultation.",
    currency: 'USD',
    products: [
      { name: 'Cleaning', description: 'Professional scaling & polishing', price: 80, isActive: true },
      { name: 'Whitening', description: 'In-office whitening, 1 session', price: 250, isActive: true },
      { name: 'Filling', description: 'Composite filling, single tooth', price: 120, isActive: true },
    ],
    services: [
      { name: 'Free consultation', description: 'First visit, including X-ray and treatment plan', isActive: true },
      { name: 'Orthodontics', description: 'Braces and Invisalign, payment plans available', isActive: true },
      { name: 'Pediatric dentistry', description: 'Children from age 2, friendly team', isActive: true },
    ],
  },
  ru: {
    name: 'Demo Стоматология',
    systemPrompt:
      'Ты ассистент стоматологической клиники. Отвечай на вопросы пациентов о процедурах, ценах и записи. После помощи мягко предложи оставить контакт, чтобы специалист перезвонил. Никогда не ставь диагнозы — рекомендуй запись на консультацию.',
    welcomeMessage:
      '🦷 *Добро пожаловать в Demo Стоматологию*\n\nСовременный подход, бережные руки.\nЗадайте вопрос — я отвечу и помогу записаться на бесплатную консультацию.',
    currency: 'RUB',
    products: [
      { name: 'Чистка зубов', description: 'Профессиональная чистка и полировка', price: 3500, isActive: true },
      { name: 'Отбеливание', description: 'Кабинетное отбеливание, 1 сеанс', price: 12000, isActive: true },
      { name: 'Пломба', description: 'Композитная пломба, один зуб', price: 4500, isActive: true },
    ],
    services: [
      { name: 'Бесплатная консультация', description: 'Первый визит с рентгеном и планом лечения', isActive: true },
      { name: 'Ортодонтия', description: 'Брекеты и Invisalign, рассрочка', isActive: true },
      { name: 'Детская стоматология', description: 'Дети от 2 лет, дружелюбная команда', isActive: true },
    ],
  },
  uz: {
    name: 'Demo Stomatologiya',
    systemPrompt:
      "Siz stomatologiya klinikasining yordamchisisiz. Bemorlarning muolajalar, narxlar va yozilish haqidagi savollariga javob bering. Yordam berganingizdan so'ng, mutaxassis qayta qo'ng'iroq qilishi uchun kontakt qoldirishni ohista taklif qiling. Hech qachon tashxis qo'ymang — konsultatsiyaga yozilishni tavsiya qiling.",
    welcomeMessage:
      "🦷 *Demo Stomatologiyaga xush kelibsiz*\n\nZamonaviy yondashuv, ehtiyotkor qo'llar.\nSavol bering — javob beraman va bepul konsultatsiyaga yozilishga yordam beraman.",
    currency: 'UZS',
    products: [
      { name: 'Tish tozalash', description: "Professional tozalash va silliqlash", price: 300000, isActive: true },
      { name: 'Oqartirish', description: "Klinikada oqartirish, 1 seans", price: 1200000, isActive: true },
      { name: 'Plomba', description: "Kompozit plomba, bitta tish", price: 450000, isActive: true },
    ],
    services: [
      { name: 'Bepul konsultatsiya', description: "Birinchi tashrif: rentgen va davolash rejasi", isActive: true },
      { name: 'Ortodontiya', description: "Breket va Invisalign, bo'lib to'lash mumkin", isActive: true },
      { name: 'Bolalar stomatologiyasi', description: "2 yoshdan, do'stona jamoa", isActive: true },
    ],
  },
};

export function getDemoPreset(type: DemoType, lang: DemoLang = 'en'): DemoPreset {
  return type === 'order' ? orderPreset[lang] : leadPreset[lang];
}
