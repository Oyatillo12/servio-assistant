import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatHistory } from './entities/chat-history.entity.js';
import { ChatSession } from './entities/chat-session.entity.js';
import type { UpdateLeadDto } from './dto/update-lead.dto.js';
import { ChatGateway } from './chat.gateway.js';

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatHistory)
    private readonly historyRepo: Repository<ChatHistory>,
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  // ── Sessions ─────────────────────────────────────────────

  async getSession(chatId: number): Promise<ChatSession | null> {
    return this.sessionRepo.findOne({ where: { chatId } });
  }

  async setSession(
    chatId: number,
    clientId: number,
    lang = 'en',
  ): Promise<ChatSession> {
    let session = await this.sessionRepo.findOne({ where: { chatId } });
    if (session) {
      session.clientId = clientId;
      session.lang = lang;
    } else {
      session = this.sessionRepo.create({ chatId, clientId, lang });
    }
    return this.sessionRepo.save(session);
  }

  async setLanguage(chatId: number, lang: string): Promise<void> {
    await this.sessionRepo.update({ chatId }, { lang });
  }

  // ── Messages ─────────────────────────────────────────────

  /**
   * Persist a message AND broadcast it to any admin watching Live Chat.
   * Single source of truth so we never drift between storage and socket.
   */
  async addMessage(
    chatId: number,
    clientId: number,
    role: 'user' | 'assistant',
    message: string,
  ): Promise<void> {
    const row = await this.historyRepo.save(
      this.historyRepo.create({ chatId, clientId, role, message }),
    );
    try {
      this.gateway.broadcastChatMessage({
        chatId,
        clientId,
        role,
        message,
        at: row.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    } catch (err) {
      // Never let a socket failure break the message pipeline.
      this.logger.warn(
        `Broadcast failed for chat ${chatId}: ${(err as Error).message}`,
      );
    }
  }

  async getRecentHistory(
    chatId: number,
    clientId: number,
  ): Promise<ChatHistory[]> {
    return this.historyRepo
      .find({
        where: { chatId, clientId },
        order: { createdAt: 'DESC' },
        take: MAX_HISTORY_MESSAGES,
      })
      .then((rows) => rows.reverse());
  }

  // ── Lead qualification ───────────────────────────────────

  /**
   * Update a session's lead score and BANT metadata in one SQL statement.
   *
   * - score / leadStatus / isAiActive are plain column writes when provided.
   * - metadata is merged via `COALESCE(metadata, '{}'::jsonb) || :patch::jsonb`
   *   so keys omitted from the patch are preserved — no read-modify-write race.
   * - lastMessageAt is bumped to NOW() on every qualification edit.
   */
  async updateLeadQualification(
    chatId: number,
    patch: UpdateLeadDto,
  ): Promise<ChatSession | null> {
    const setters: Record<string, unknown> = {
      lastMessageAt: () => 'NOW()',
    };

    if (patch.score !== undefined) setters.score = patch.score;
    if (patch.leadStatus !== undefined) setters.leadStatus = patch.leadStatus;
    if (patch.isAiActive !== undefined) setters.isAiActive = patch.isAiActive;
    if (patch.metadata !== undefined) {
      setters.metadata = () =>
        `COALESCE("metadata", '{}'::jsonb) || :metadata::jsonb`;
    }

    const qb = this.sessionRepo
      .createQueryBuilder()
      .update(ChatSession)
      .set(setters)
      .where('chatId = :chatId', { chatId });

    if (patch.metadata !== undefined) {
      qb.setParameter('metadata', JSON.stringify(patch.metadata));
    }

    const result = await qb.execute();
    if (!result.affected) return null;
    return this.sessionRepo.findOne({ where: { chatId } });
  }
}
