export type Locale = "en" | "ru" | "uz";

/** Translation key — just a branded string for documentation */
export type TranslationKey = string;

export const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uz: "O'zbek",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
  uz: "🇺🇿",
};
