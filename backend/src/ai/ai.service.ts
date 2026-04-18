import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful AI assistant. Answer clearly and concisely.';

const MAX_RESPONSE_LENGTH = 2000; // Telegram message limit safety
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;
  private readonly defaultSystemPrompt: string;

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(
      this.config.getOrThrow<string>('GEMINI_API_KEY'),
    );
    this.model = this.config.get<string>('AI_MODEL', 'gemini-pro');
    this.defaultSystemPrompt = this.config.get<string>(
      'SYSTEM_PROMPT',
      DEFAULT_SYSTEM_PROMPT,
    );

    this.logger.log(`AI service initialized (model: ${this.model})`);
  }

  /**
   * Send a message to the AI and return the text response.
   * @param message  - The user's message
   * @param systemPrompt - Client-specific system prompt (falls back to default)
   * @param history  - Optional recent chat history for context
   */
  async ask(
    message: string,
    systemPrompt?: string,
    history?: Array<{ role: 'user' | 'assistant'; message: string }>,
  ): Promise<string> {
    const prompt = systemPrompt ?? this.defaultSystemPrompt;

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: prompt,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });

      // Build chat history if provided
      const chatHistory =
        history?.map((h) => ({
          role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: h.message }],
        })) ?? [];

      const chat = model.startChat({ history: chatHistory });

      const result = await Promise.race([
        chat.sendMessage(message),
        this.timeout(REQUEST_TIMEOUT_MS),
      ]);

      const text = result.response.text();

      if (!text) {
        this.logger.warn('AI returned empty response');
        return 'I could not generate a response. Please try again.';
      }

      if (text.length > MAX_RESPONSE_LENGTH) {
        return text.slice(0, MAX_RESPONSE_LENGTH) + '…';
      }

      return text;
    } catch (error) {
      this.logger.error('AI request failed', error);
      return 'Sorry, something went wrong. Please try again later.';
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`AI request timed out after ${ms}ms`)),
        ms,
      ),
    );
  }

  /**
   * Generates a short, clear description for a product or service.
   */
  async generateProductDescription(name: string, type: 'product' | 'service', keywords?: string): Promise<string> {
    const prompt = `Write a short, clear, attractive description for a ${type} called: "${name}".
    Keep it under 2-3 sentences.
    Use simple language.
    Make it suitable for customers.
    ${keywords ? `Include these keywords: ${keywords}` : ''}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: 'You are an expert copywriter. Output only the final description text, without any introductory phrases or quotes.',
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.7,
        },
      });

      const chat = model.startChat();
      const result = await Promise.race([
        chat.sendMessage(prompt),
        this.timeout(15_000),
      ]);

      const text = result.response.text();
      return text?.trim().replace(/^"|"$/g, '') || '';
    } catch (error) {
      this.logger.error(`AI description generation failed for ${name}`, error);
      throw new Error('Failed to generate description');
    }
  }
}
