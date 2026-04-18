import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { I18nService, type Lang } from '../i18n/i18n.service.js';
import type { Client } from '../client/entities/client.entity.js';
import type { Order } from '../order/entities/order.entity.js';
import type { Lead } from '../lead/entities/lead.entity.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly i18n: I18nService) {}

  async notifyNewOrder(
    bot: TelegramBot,
    client: Client,
    order: Order,
    lang: Lang,
  ): Promise<void> {
    const itemLines = order.items.map((item) => {
      const priceStr = item.price != null ? ` x $${item.price}` : '';
      return `  • ${item.productName} — ${item.quantity}${priceStr}`;
    });

    const text = this.i18n.t('admin_new_order', lang, {
      orderId: String(order.id),
      clientName: client.name,
      items: itemLines.join('\n'),
      phone: order.phone,
      address: order.address || '—',
    });

    if (client.adminChatId) {
      try {
        await bot.sendMessage(client.adminChatId, text, {
          parse_mode: 'Markdown',
        });
        this.logger.log(
          `Admin notified (chat ${client.adminChatId}) about order #${order.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to notify admin chat ${client.adminChatId}: ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.log(
        `New order #${order.id} — ${itemLines.length} item(s) — phone: ${order.phone}`,
      );
    }
  }

  async notifyNewLead(
    bot: TelegramBot,
    client: Client,
    lead: Lead,
    lang: Lang,
  ): Promise<void> {
    const text = this.i18n.t('admin_new_lead', lang, {
      leadId: String(lead.id),
      clientName: client.name,
      name: lead.name,
      phone: lead.phone,
      notes: lead.notes || '—',
    });

    if (client.adminChatId) {
      try {
        await bot.sendMessage(client.adminChatId, text, {
          parse_mode: 'Markdown',
        });
        this.logger.log(
          `Admin notified (chat ${client.adminChatId}) about lead #${lead.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to notify admin chat ${client.adminChatId}: ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.log(
        `New lead #${lead.id} — ${lead.name} — phone: ${lead.phone}`,
      );
    }
  }
}
