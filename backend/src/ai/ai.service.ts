import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  type AiProviderType,
  type LlmMessage,
  type LlmProvider,
  type ProviderConfig,
} from './llm-provider.js';
import { GeminiService } from './providers/gemini.service.js';
import { OpenAiService } from './providers/openai.service.js';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful AI assistant. Answer clearly and concisely.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly defaultSystemPrompt: string;
  /** Env-configured default model for the default provider (gemini). */
  private readonly envGeminiModel: string;

  constructor(
    config: ConfigService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
  ) {
    this.envGeminiModel = config.get<string>('AI_MODEL', DEFAULT_MODELS.gemini);
    this.defaultSystemPrompt = config.get<string>(
      'SYSTEM_PROMPT',
      DEFAULT_SYSTEM_PROMPT,
    );
    this.logger.log(
      `AI router initialized (default: ${DEFAULT_PROVIDER}/${this.envGeminiModel})`,
    );
  }

  /**
   * Main entry point: route the request to the provider named in config.
   * Callers are responsible for supplying a valid provider + model pair.
   */
  generateResponse(input: string, config: ProviderConfig): Promise<string> {
    const provider = this.resolve(config.aiProvider);
    return provider.generateResponse(input, config);
  }

  /**
   * Backward-compat wrapper for the previous `ask(message, systemPrompt, history)`
   * shape. When no `client` config is supplied, falls back to gemini + env model.
   */
  async ask(
    message: string,
    systemPrompt?: string,
    history?: LlmMessage[],
    client?: { aiProvider?: AiProviderType | null; aiModel?: string | null },
  ): Promise<string> {
    const aiProvider =
      client?.aiProvider && this.isValidProvider(client.aiProvider)
        ? client.aiProvider
        : DEFAULT_PROVIDER;
    const model =
      client?.aiModel?.trim() ||
      (aiProvider === 'gemini'
        ? this.envGeminiModel
        : DEFAULT_MODELS[aiProvider]);

    return this.generateResponse(message, {
      aiProvider,
      model,
      systemPrompt: systemPrompt ?? this.defaultSystemPrompt,
      history,
    });
  }

  /** Admin tool — always uses the default Gemini model for deterministic UX. */
  async generateProductDescription(
    name: string,
    type: 'product' | 'service',
    keywords?: string,
  ): Promise<string> {
    const prompt = `Write a short, clear, attractive description for a ${type} called: "${name}".
    Keep it under 2-3 sentences.
    Use simple language.
    Make it suitable for customers.
    ${keywords ? `Include these keywords: ${keywords}` : ''}`;

    try {
      return await this.gemini.generateShort(
        prompt,
        'You are an expert copywriter. Output only the final description text, without any introductory phrases or quotes.',
        this.envGeminiModel,
      );
    } catch (err) {
      this.logger.error(
        `AI description generation failed for "${name}": ${(err as Error).message}`,
      );
      throw new Error('Failed to generate description');
    }
  }

  // ── Internals ────────────────────────────────────────────

  private resolve(kind: AiProviderType): LlmProvider {
    switch (kind) {
      case 'openai':
        return this.openai;
      case 'gemini':
      default:
        return this.gemini;
    }
  }

  private isValidProvider(v: string): v is AiProviderType {
    return v === 'gemini' || v === 'openai';
  }
}
