export type AiProviderType = "gemini" | "openai";

export const AI_MODELS: Record<AiProviderType, readonly string[]> = {
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  openai: ["gpt-4o-mini", "gpt-4o"],
} as const;

export const DEFAULT_MODELS: Record<AiProviderType, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
};

export const PROVIDER_LABELS: Record<AiProviderType, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
};
