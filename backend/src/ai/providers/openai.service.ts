import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type {
  AiProviderType,
  LlmProvider,
  ProviderConfig,
} from '../llm-provider.js';

const MAX_RESPONSE_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class OpenAiService implements LlmProvider {
  readonly kind: AiProviderType = 'openai';

  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.client = apiKey
      ? new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS })
      : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY not set — OpenAI provider will reject requests',
      );
    }
  }

  async generateResponse(
    input: string,
    config: ProviderConfig,
  ): Promise<string> {
    if (!this.client) {
      this.logger.error('OpenAI requested but no API key configured');
      return 'OpenAI is not configured on this server.';
    }

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (config.systemPrompt) {
        messages.push({ role: 'system', content: config.systemPrompt });
      }
      for (const h of config.history ?? []) {
        messages.push({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.message,
        });
      }
      messages.push({ role: 'user', content: input });

      const completion = await this.client.chat.completions.create({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!text) {
        this.logger.warn('OpenAI returned empty response');
        return 'I could not generate a response. Please try again.';
      }
      return text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + '…'
        : text;
    } catch (err) {
      this.logger.error(
        `OpenAI request failed (model=${config.model}): ${(err as Error).message}`,
      );
      return 'Sorry, something went wrong. Please try again later.';
    }
  }
}
