import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LeadStatus } from './lead-status.enum.js';

/**
 * BANT qualification data stored on a chat session.
 * All fields optional — populated progressively by the AI or by manual admin edits.
 */
export interface BantMetadata {
  /** Raw budget mention, e.g. "500 USD / month" */
  budget?: string;
  /** Whether the user is the decision-maker */
  authority?: 'decision_maker' | 'influencer' | 'user' | 'unknown';
  /** Free-text summary of the pain / desired outcome */
  need?: string;
  /** When they want to act, e.g. "Q2 2026", "ASAP", "no deadline" */
  timeline?: string;
  /** Any other notes the AI wants to persist between turns */
  notes?: string;
  /** Arbitrary extension — allows adding new qualification dimensions without a migration */
  [key: string]: unknown;
}

/** Maps a Telegram chat to a specific client and stores user preferences + lead qualification. */
@Entity('chat_sessions')
@Unique(['chatId'])
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number;

  /** Telegram chat ID */
  @Column({ type: 'bigint' })
  chatId: number;

  /** The client this chat is linked to */
  @Column()
  clientId: number;

  /** User's preferred language */
  @Column({ type: 'varchar', length: 5, default: 'en' })
  lang: string;

  // ── Lead qualification ─────────────────────────────────────

  /** Numeric lead score (0-100 by convention; not hard-capped). */
  @Column({ type: 'int', default: 0 })
  score: number;

  /** Qualification tier derived from score + BANT. */
  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.COLD })
  leadStatus: LeadStatus;

  /** When false, AI chat is suppressed and a human operator is expected to take over. */
  @Column({ type: 'boolean', default: true })
  isAiActive: boolean;

  /**
   * BANT (Budget, Authority, Need, Timeline) plus freeform notes.
   * Uses jsonb for indexable/partial-queryable storage on PostgreSQL.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: BantMetadata | null;

  // ── Timestamps ────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Last time the user or the bot exchanged a message on this session.
   * Updated explicitly by the chat service on every message so it reflects
   * conversation activity (not just row edits).
   */
  @UpdateDateColumn()
  lastMessageAt: Date;

  /**
   * When (and whether) the abandoned-lead recovery cron has sent its one
   * follow-up message. NULL means "eligible for recovery"; any non-null
   * value guarantees we never spam a second recovery message on the same
   * session.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  recoverySentAt: Date | null;
}
