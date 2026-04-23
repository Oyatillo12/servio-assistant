import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AiService } from './ai.service.js';
import { ChatService } from '../chat/chat.service.js';
import {
  buildSalesAgentPrompt,
  type SalesPromptContext,
} from './prompts/sales-agent.prompt.js';
import { LeadStatus } from '../chat/entities/lead-status.enum.js';
import type {
  BantMetadata,
  ChatSession,
} from '../chat/entities/chat-session.entity.js';
import type { AiProviderType, LlmMessage } from './llm-provider.js';

/**
 * Structured payload emitted by the LLM at the end of every sales reply.
 * Produced by the parser; shape matches the tag the prompt instructs.
 */
export interface SalesSignal {
  score: number;
  intent: 'low' | 'medium' | 'high' | 'buying';
  bant: BantMetadata;
}

/** Event name for admin hand-off when a lead crosses the hot threshold. */
export const SALES_HANDOVER_EVENT = 'sales.handover';
/** Event name for real-time score broadcast to admin panel. */
export const SCORE_UPDATED_EVENT = 'sales.score_updated';
/** Score threshold above which we flip to admin. */
export const HANDOVER_SCORE_THRESHOLD = 80;

export interface SalesHandoverEvent {
  chatId: number;
  clientId: number;
  score: number;
  intent: SalesSignal['intent'];
  bant: BantMetadata;
  /** The visible reply the user is about to receive */
  reply: string;
}

export interface ScoreUpdatedEvent {
  chatId: number;
  clientId: number;
  score: number;
  leadStatus: LeadStatus;
  intent: SalesSignal['intent'];
  bant: BantMetadata;
}

/**
 * Regex that captures the final metadata tag appended by the LLM.
 * Format: `[[SCORE: N | INTENT: label | BANT: {...json...}]]`
 *
 * - `\[\[` and `\]\]` are the literal brackets.
 * - We allow whitespace around every pipe and use a lazy JSON body so a stray
 *   `]` inside string values doesn't terminate the match early.
 */
const SIGNAL_REGEX =
  /\[\[\s*SCORE\s*:\s*(\d+)\s*\|\s*INTENT\s*:\s*([a-zA-Z_-]+)\s*\|\s*BANT\s*:\s*(\{[\s\S]*?\})\s*\]\]/i;

@Injectable()
export class SalesAiService {
  private readonly logger = new Logger(SalesAiService.name);

  constructor(
    private readonly ai: AiService,
    private readonly chat: ChatService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Generate a sales reply for a single user turn.
   *
   * Pipeline:
   *   1. Build the BANT system prompt using client context + what we already know
   *      from prior turns (session.metadata).
   *   2. Ask the configured LLM (per-client provider/model).
   *   3. Parse the trailing `[[SCORE | INTENT | BANT]]` tag out of the response.
   *   4. Atomically write the new score + merged BANT into the session.
   *   5. Emit `sales.handover` when score crosses the threshold.
   *   6. Return the cleaned text (tag stripped) for the user.
   */
  async generateSalesReply(params: {
    chatId: number;
    clientId: number;
    userMessage: string;
    promptContext: SalesPromptContext;
    history?: LlmMessage[];
    aiProvider?: AiProviderType | null;
    aiModel?: string | null;
  }): Promise<string> {
    const session = await this.chat.getSession(params.chatId);
    const knownBant = session?.metadata ?? undefined;

    const systemPrompt = buildSalesAgentPrompt({
      ...params.promptContext,
      knownBant,
    });

    const raw = await this.ai.ask(
      params.userMessage,
      systemPrompt,
      params.history,
      { aiProvider: params.aiProvider, aiModel: params.aiModel },
    );

    const { clean, signal } = this.parseSignal(raw);

    // If the LLM forgot the tag we just skip scoring for this turn —
    // retrying via a second LLM call was doubling cost/latency on every miss
    // for metadata the user never sees. A single warn in parseSignal is enough.
    if (signal) {
      await this.applySignal(params.chatId, params.clientId, signal, clean);
    }

    return clean;
  }

  // ── Parsing ──────────────────────────────────────────────

  /**
   * Intercept the LLM response and split it into
   *   - `clean`: the text shown to the user (tag stripped, trimmed)
   *   - `signal`: parsed SCORE / INTENT / BANT, or `null` if the model forgot the tag.
   */
  parseSignal(raw: string): { clean: string; signal: SalesSignal | null } {
    const match = SIGNAL_REGEX.exec(raw);
    if (!match) {
      // LLM forgot the tag — return text as-is but log so we can tune the prompt.
      this.logger.warn('Sales reply missing [[SCORE|INTENT|BANT]] tag');
      return { clean: this.cleanText(raw), signal: null };
    }

    const [, scoreStr, intentRaw, bantRaw] = match;
    const score = this.clampScore(parseInt(scoreStr, 10));
    const intent = this.normaliseIntent(intentRaw);
    const bant = this.safeParseBant(bantRaw);

    const clean = this.cleanText(raw.replace(SIGNAL_REGEX, ''));
    return { clean, signal: { score, intent, bant } };
  }

  private cleanText(s: string): string {
    return s.replace(/\s+$/g, '').trim();
  }

  private clampScore(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  private normaliseIntent(v: string): SalesSignal['intent'] {
    const k = v.toLowerCase().trim();
    return k === 'buying' || k === 'high' || k === 'medium' || k === 'low'
      ? (k as SalesSignal['intent'])
      : 'low';
  }

  /**
   * Parse the BANT payload. First try strict JSON; if the model produced
   * single-quoted or unquoted-key output, fall back to a forgiving reader
   * rather than dropping the data.
   */
  private safeParseBant(raw: string): BantMetadata {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as BantMetadata;
      }
    } catch {
      // fall through to tolerant parse
    }

    // Tolerant: quote unquoted keys and convert single-quoted values to double-quoted.
    try {
      const fixed = raw
        .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*?)'/g, ': "$1"');
      const parsed = JSON.parse(fixed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as BantMetadata;
      }
    } catch {
      this.logger.warn(`Could not parse BANT JSON: ${raw.slice(0, 120)}`);
    }
    return {};
  }

  // ── Side effects ─────────────────────────────────────────

  /**
   * Persist the new score + merged BANT, promote leadStatus based on thresholds,
   * and emit the handover event when the score crosses the threshold.
   */
  private async applySignal(
    chatId: number,
    clientId: number,
    signal: SalesSignal,
    reply: string,
  ): Promise<void> {
    const nextStatus = this.statusFromScore(signal.score);

    try {
      await this.chat.updateLeadQualification(chatId, {
        score: signal.score,
        leadStatus: nextStatus,
        metadata: signal.bant,
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist sales signal for chat ${chatId}: ${(err as Error).message}`,
      );
    }

    // Always broadcast score updates so admin Live Chat updates in real time
    const scorePayload: ScoreUpdatedEvent = {
      chatId,
      clientId,
      score: signal.score,
      leadStatus: nextStatus,
      intent: signal.intent,
      bant: signal.bant,
    };
    this.events.emit(SCORE_UPDATED_EVENT, scorePayload);

    if (signal.score > HANDOVER_SCORE_THRESHOLD) {
      const payload: SalesHandoverEvent = {
        chatId,
        clientId,
        score: signal.score,
        intent: signal.intent,
        bant: signal.bant,
        reply,
      };
      this.events.emit(SALES_HANDOVER_EVENT, payload);
      this.logger.log(
        `Handover triggered — chat ${chatId} (score=${signal.score}, intent=${signal.intent})`,
      );
    }
  }

  private statusFromScore(score: number): LeadStatus {
    if (score >= 90) return LeadStatus.CLOSED;
    if (score > HANDOVER_SCORE_THRESHOLD) return LeadStatus.HOT;
    if (score >= 40) return LeadStatus.WARM;
    return LeadStatus.COLD;
  }
}

// Re-exported for consumers building the session update payload themselves.
export type { ChatSession };
