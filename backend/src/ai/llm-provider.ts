export type AiProviderType = 'gemini' | 'openai';

export interface LlmMessage {
  role: 'user' | 'assistant';
  message: string;
}

/**
 * Runtime configuration for a single generation request.
 * `aiProvider` is the discriminator the router uses; concrete providers
 * read `model`, `systemPrompt`, and `history`.
 */
export interface ProviderConfig {
  aiProvider: AiProviderType;
  model: string;
  systemPrompt?: string;
  history?: LlmMessage[];
}

/** Common interface implemented by every concrete LLM provider. */
export interface LlmProvider {
  readonly kind: AiProviderType;
  generateResponse(input: string, config: ProviderConfig): Promise<string>;
}

// ── Model catalogues (UI + validation) ───────────────────────

/** Models we explicitly support in the admin UI, per provider. */
export const SUPPORTED_MODELS: Record<AiProviderType, readonly string[]> = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],
  openai: ['gpt-4o-mini', 'gpt-4o'],
} as const;

export const DEFAULT_MODELS: Record<AiProviderType, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
};

export const DEFAULT_PROVIDER: AiProviderType = 'gemini';

export function isValidProvider(v: unknown): v is AiProviderType {
  return v === 'gemini' || v === 'openai';
}
