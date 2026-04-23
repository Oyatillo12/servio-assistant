import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoreThanOrEqual } from 'typeorm';
import { ChatHistory } from '../chat/entities/chat-history.entity.js';
import { ChatSession } from '../chat/entities/chat-session.entity.js';
import { LeadStatus } from '../chat/entities/lead-status.enum.js';
import { Client } from '../client/entities/client.entity.js';
import { OrderService } from '../order/order.service.js';
import { LeadService } from '../lead/lead.service.js';

export interface DashboardStats {
  totalClients: number;
  totalConversations: number;
  totalMessages: number;
  messagesToday: number;
  /** New ChatSession rows created since midnight (local server time). */
  conversationsToday: number;
  /** Orders created since midnight. */
  ordersToday: number;
  /** Leads created since midnight. */
  leadsToday: number;
  /** Active hot sessions — score > 80 and not closed. */
  hotLeadsCount: number;
  totalOrders: number;
  totalLeads: number;
  recentActivity: Array<{
    clientId: number;
    clientName: string;
    messageCount: number;
  }>;
  recentOrders: import('../order/entities/order.entity.js').Order[];
  recentLeads: import('../lead/entities/lead.entity.js').Lead[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ChatHistory)
    private readonly historyRepo: Repository<ChatHistory>,
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly orderService: OrderService,
    private readonly leadService: LeadService,
  ) {}

  async getDashboard(clientId?: number): Promise<DashboardStats> {
    const clientWhere = clientId ? { id: clientId } : {};
    const historyWhere = clientId ? { clientId } : {};

    // Midnight cutoff used by every "today" counter below.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [
      totalClients,
      totalConversations,
      totalMessages,
      totalOrders,
      totalLeads,
      conversationsToday,
      ordersToday,
      leadsToday,
      hotLeadsCount,
    ] = await Promise.all([
      this.clientRepo.count({ where: clientWhere }),
      this.sessionRepo.count(clientId ? { where: { clientId } } : {}),
      this.historyRepo.count({ where: historyWhere }),
      this.orderService.countByClient(clientId),
      this.leadService.countByClient(clientId),
      this.sessionRepo.count({
        where: {
          createdAt: MoreThanOrEqual(today),
          ...(clientId ? { clientId } : {}),
        },
      }),
      this.orderService.countSince(today, clientId),
      this.leadService.countSince(today, clientId),
      this.countHotSessions(clientId),
    ]);

    const [recentOrders, recentLeads] = await Promise.all([
      this.orderService.findRecent(clientId),
      this.leadService.findRecent(clientId),
    ]);

    const todayQuery = this.historyRepo
      .createQueryBuilder('h')
      .where('h.createdAt >= :today', { today: today.toISOString() });
    if (clientId) {
      todayQuery.andWhere('h.clientId = :clientId', { clientId });
    }
    const messagesToday = await todayQuery.getCount();

    // Recent activity per client (top 10)
    const activityQuery = this.historyRepo
      .createQueryBuilder('h')
      .select('h.clientId', 'clientId')
      .addSelect('COUNT(*)', 'messageCount')
      .groupBy('h.clientId')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10);

    if (clientId) {
      activityQuery.where('h.clientId = :clientId', { clientId });
    }

    const rawActivity = await activityQuery.getRawMany();

    // Enrich with client names
    const clients = await this.clientRepo.find({ where: clientWhere });
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));

    const recentActivity = rawActivity.map((r) => ({
      clientId: Number(r.clientId),
      clientName: clientMap.get(Number(r.clientId)) ?? 'Unknown',
      messageCount: Number(r.messageCount),
    }));

    return {
      totalClients,
      totalConversations,
      totalMessages,
      messagesToday,
      conversationsToday,
      ordersToday,
      leadsToday,
      hotLeadsCount,
      totalOrders,
      totalLeads,
      recentActivity,
      recentOrders,
      recentLeads,
    };
  }

  /** Count active hot sessions (score > 80 and not closed). */
  private async countHotSessions(clientId?: number): Promise<number> {
    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .where('s.score > :threshold', { threshold: 80 })
      .andWhere('s.leadStatus != :closed', { closed: LeadStatus.CLOSED });
    if (clientId) qb.andWhere('s.clientId = :clientId', { clientId });
    return qb.getCount();
  }

  async getClientMessages(
    clientId: number,
    page = 1,
    limit = 50,
  ): Promise<{ data: ChatHistory[]; total: number }> {
    const [data, total] = await this.historyRepo.findAndCount({
      where: { clientId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
