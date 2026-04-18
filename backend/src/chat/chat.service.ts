import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatHistory } from './entities/chat-history.entity.js';
import { ChatSession } from './entities/chat-session.entity.js';

const MAX_HISTORY_MESSAGES = 6;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatHistory)
    private readonly historyRepo: Repository<ChatHistory>,
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
  ) {}

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

  async addMessage(
    chatId: number,
    clientId: number,
    role: 'user' | 'assistant',
    message: string,
  ): Promise<void> {
    await this.historyRepo.save(
      this.historyRepo.create({ chatId, clientId, role, message }),
    );
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
}
