import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import {
  SALES_HANDOVER_EVENT,
  SCORE_UPDATED_EVENT,
  type SalesHandoverEvent,
  type ScoreUpdatedEvent,
} from '../ai/sales-ai.service.js';
import { Role } from '../auth/entities/user.entity.js';

/** Minimal shape of a JWT payload used for socket auth. Matches jwt.strategy.ts. */
interface JwtPayload {
  sub: number;
  login: string;
  role: Role;
  clientId?: number | null;
}

export const HOT_LEAD_EVENT = 'new_hot_lead';
export const USER_MESSAGE_EVENT = 'chat_message';
export const AI_TOGGLED_EVENT = 'chat_ai_toggled';
export const LEAD_SCORE_UPDATED_EVENT = 'lead_score_updated';

/** Payload broadcast to admins when a user posts into a handover-mode chat. */
export interface ChatMessageEventPayload {
  chatId: number;
  clientId: number;
  role: 'user' | 'assistant';
  message: string;
  at: string;
}

export interface AiToggledEventPayload {
  chatId: number;
  clientId: number;
  isAiActive: boolean;
}

/**
 * `origin: '*'` + `credentials: true` is invalid per the CORS spec (browsers
 * reject the pre-flight). Use the same parser as HTTP CORS so the two stay
 * aligned; unset env reflects the requesting origin instead.
 */
import { parseAllowedOrigins } from '../main';

/**
 * Realtime channel for admin surfaces.
 *
 * - Clients connect with a JWT in `handshake.auth.token` (or the Authorization header).
 * - Super admins join the `admins:super` room and receive every event.
 * - Client admins join `admins:client:<clientId>` and only see their client's events.
 * - We re-broadcast the sales.handover domain event so the admin UI gets a
 *   `new_hot_lead` toast the moment the backend scores a prospect >80.
 */
@WebSocketGateway({
  namespace: '/ws/chat',
  cors: {
    origin: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  // ── Connection lifecycle ────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const token = extractToken(client);
    if (!token) {
      this.logger.warn(`WS connection without token from ${client.id}`);
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch (err) {
      this.logger.warn(
        `WS rejected (invalid token): ${(err as Error).message}`,
      );
      client.disconnect(true);
      return;
    }

    // Stash on the socket for later use (manual send, room membership checks).
    (client.data as { user: JwtPayload }).user = payload;

    if (payload.role === Role.SUPER_ADMIN) {
      await client.join('admins:super');
    } else if (payload.role === Role.CLIENT_ADMIN && payload.clientId != null) {
      await client.join(clientRoom(payload.clientId));
    } else {
      this.logger.warn(`WS rejected (unauthorized role): ${payload.role}`);
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `WS connected ${client.id} — ${payload.role} (client #${payload.clientId ?? '*'})`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnected ${client.id}`);
  }

  // ── Domain event subscriptions ──────────────────────────

  /** Re-broadcast the SalesAiService hand-off signal as `new_hot_lead`. */
  @OnEvent(SALES_HANDOVER_EVENT)
  handleSalesHandover(event: SalesHandoverEvent): void {
    this.server
      .to([clientRoom(event.clientId), 'admins:super'])
      .emit(HOT_LEAD_EVENT, event);
    this.logger.log(
      `[${HOT_LEAD_EVENT}] chat ${event.chatId} client #${event.clientId} score=${event.score}`,
    );
  }

  /** Re-broadcast score updates so admin Live Chat shows real-time BANT progress. */
  @OnEvent(SCORE_UPDATED_EVENT)
  handleScoreUpdated(event: ScoreUpdatedEvent): void {
    this.server
      .to([clientRoom(event.clientId), 'admins:super'])
      .emit(LEAD_SCORE_UPDATED_EVENT, event);
    this.logger.debug(
      `[${LEAD_SCORE_UPDATED_EVENT}] chat ${event.chatId} score=${event.score} status=${event.leadStatus}`,
    );
  }

  // ── Helpers invoked by ChatController / BotService ──────

  /** Broadcast a chat message (user or admin) to the relevant admin room. */
  broadcastChatMessage(payload: ChatMessageEventPayload): void {
    this.server
      .to([clientRoom(payload.clientId), 'admins:super'])
      .emit(USER_MESSAGE_EVENT, payload);
  }

  /** Broadcast an AI-mode flip so open admin UIs update the toggle. */
  broadcastAiToggled(payload: AiToggledEventPayload): void {
    this.server
      .to([clientRoom(payload.clientId), 'admins:super'])
      .emit(AI_TOGGLED_EVENT, payload);
  }
}

function clientRoom(clientId: number): string {
  return `admins:client:${clientId}`;
}

function extractToken(client: Socket): string | null {
  const auth = client.handshake.auth as { token?: string } | undefined;
  if (auth?.token) return auth.token.replace(/^Bearer\s+/i, '');
  const header = client.handshake.headers.authorization;
  if (typeof header === 'string') {
    return header.replace(/^Bearer\s+/i, '');
  }
  return null;
}
