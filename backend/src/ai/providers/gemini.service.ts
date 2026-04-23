import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

import type {
  AiProviderType,
  LlmProvider,
  ProviderConfig,
} from '../llm-provider.js';

const MAX_RESPONSE_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class GeminiService implements LlmProvider {
  readonly kind: AiProviderType = 'gemini';

  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI;

  constructor(config: ConfigService) {
    this.client = new GoogleGenerativeAI(
      config.getOrThrow<string>('GEMINI_API_KEY'),
    );
  }

  async generateResponse(
    input: string,
    config: ProviderConfig,
  ): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: config.model,
        systemInstruction: config.systemPrompt,
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        },
      });

      const chatHistory = this.sanitizeHistory(config.history);

      const chat = model.startChat({ history: chatHistory });

      const result = await Promise.race([
        chat.sendMessage(input),
        this.timeout(REQUEST_TIMEOUT_MS),
      ]);

      const text = result.response.text();
      if (!text) {
        this.logger.warn('Gemini returned empty response');
        return 'I could not generate a response. Please try again.';
      }
      return text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + '…'
        : text;
    } catch (err) {
      this.logger.error(
        `Gemini request failed (model=${config.model}): ${(err as Error).message}`,
      );
      return 'Sorry, something went wrong. Please try again later.';
    }
  }

  /** One-shot text generation used by AI-assisted admin tooling. */
  async generateShort(
    prompt: string,
    systemPrompt: string,
    model: string,
  ): Promise<string> {
    const m = this.client.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    });
    const chat = m.startChat();
    const result = await Promise.race([
      chat.sendMessage(prompt),
      this.timeout(15_000),
    ]);
    return result.response.text()?.trim().replace(/^"|"$/g, '') || '';
  }

  /**
   * Sanitize chat history for the Gemini API which requires:
   *   1. First content must have role 'user'
   *   2. Roles must strictly alternate user ↔ model
   *   3. After history, sendMessage adds a 'user' turn, so history should end with 'model'
   *
   * We handle DB histories that may have leading model entries (AI hooks),
   * consecutive same-role entries (admin double-replies, user multi-messages),
   * or trailing user entries.
   */
  private sanitizeHistory(
    history?: { role: 'user' | 'assistant'; message: string }[],
  ): { role: 'user' | 'model'; parts: { text: string }[] }[] {
    if (!history || history.length === 0) return [];

    // Map to Gemini roles
    const mapped = history.map((h) => ({
      role: (h.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      text: h.message,
    }));

    // 1. Drop leading 'model' entries (e.g. AI-generated opening hooks)
    const firstUserIdx = mapped.findIndex((m) => m.role === 'user');
    if (firstUserIdx === -1) return [];
    const trimmed = mapped.slice(firstUserIdx);

    // 2. Merge consecutive same-role messages (concatenate text)
    const merged: { role: 'user' | 'model'; text: string }[] = [];
    for (const msg of trimmed) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === msg.role) {
        prev.text += '\n' + msg.text;
      } else {
        merged.push({ role: msg.role, text: msg.text });
      }
    }

    // 3. If history ends with 'user', drop the tail — sendMessage will re-add
    //    the current user message, and Gemini expects alternation.
    if (merged.length > 0 && merged[merged.length - 1].role === 'user') {
      merged.pop();
    }

    return merged.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini request timed out after ${ms}ms`)),
        ms,
      ),
    );
  }
}
