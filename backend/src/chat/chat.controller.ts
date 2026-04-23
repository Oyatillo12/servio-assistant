import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BotRegistry } from '../bot/bot-registry.service.js';
import { Role, User } from '../auth/entities/user.entity.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatSession } from './entities/chat-session.entity.js';
import { LeadStatus } from './entities/lead-status.enum.js';
import { ToggleAiDto } from './dto/toggle-ai.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Controller('api/chats')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ChatController {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessions: Repository<ChatSession>,
    private readonly chat: ChatService,
    private readonly registry: BotRegistry,
    private readonly gateway: ChatGateway,
  ) {}

  /**
   * List live chat sessions the caller may see.
   *   - SUPER_ADMIN sees all (optionally filtered by `clientId`).
   *   - CLIENT_ADMIN sees only their own client.
   * Sorted by most-recent activity so hot leads surface first.
   */
  @Get()
  async list(
    @Request() req: { user: User },
    @Query('clientId') clientIdStr?: string,
    @Query('hot') hotOnly?: string,
  ): Promise<ChatSession[]> {
    const qb = this.sessions
      .createQueryBuilder('s')
      .orderBy('s.lastMessageAt', 'DESC')
      .limit(200);

    if (req.user.role === Role.CLIENT_ADMIN) {
      if (!req.user.clientId) return [];
      qb.andWhere('s.clientId = :cid', { cid: req.user.clientId });
    } else if (clientIdStr) {
      qb.andWhere('s.clientId = :cid', { cid: Number(clientIdStr) });
    }

    if (hotOnly === '1' || hotOnly === 'true') {
      qb.andWhere('s.score > :threshold', { threshold: 80 });
      qb.andWhere('s.leadStatus != :closed', { closed: LeadStatus.CLOSED });
    }

    return qb.getMany();
  }

  @Get(':chatId/messages')
  async messages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Request() req: { user: User },
  ) {
    const session = await this.loadSessionScoped(chatId, req.user);
    return this.chat.getRecentHistory(chatId, session.clientId);
  }

  /** Flip AI handling on/off for a single Telegram chat. */
  @Post(':chatId/toggle-ai')
  async toggleAi(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: ToggleAiDto,
    @Request() req: { user: User },
  ): Promise<ChatSession> {
    const session = await this.loadSessionScoped(chatId, req.user);

    await this.sessions.update(
      { chatId },
      { isAiActive: dto.isAiActive },
    );

    this.gateway.broadcastAiToggled({
      chatId,
      clientId: session.clientId,
      isAiActive: dto.isAiActive,
    });

    const updated = await this.sessions.findOne({ where: { chatId } });
    if (!updated) throw new NotFoundException();
    return updated;
  }

  /**
   * Admin sends a message TO the Telegram user via the client's bot.
   * Persists as an assistant-role entry in chat_history so future AI context
   * (after re-enabling AI) still has the human's messages.
   */
  @Post(':chatId/send-message')
  async send(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: SendMessageDto,
    @Request() req: { user: User },
  ): Promise<{ ok: true }> {
    const session = await this.loadSessionScoped(chatId, req.user);

    const bot = this.registry.getBotForClient(session.clientId);
    try {
      await bot.sendMessage(chatId, dto.text);
    } catch (err) {
      throw new BadRequestException(
        `Telegram rejected the message: ${(err as Error).message}`,
      );
    }

    // ChatService.addMessage handles both persistence and socket broadcast.
    await this.chat.addMessage(chatId, session.clientId, 'assistant', dto.text);

    return { ok: true };
  }

  // ── Internals ────────────────────────────────────────────

  private async loadSessionScoped(
    chatId: number,
    user: User,
  ): Promise<ChatSession> {
    const session = await this.sessions.findOne({ where: { chatId } });
    if (!session) throw new NotFoundException(`Chat ${chatId} not found`);

    if (
      user.role === Role.CLIENT_ADMIN &&
      user.clientId !== session.clientId
    ) {
      throw new ForbiddenException(
        'You do not have access to this chat session',
      );
    }
    return session;
  }
}
