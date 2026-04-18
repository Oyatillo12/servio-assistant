import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatHistory } from '../chat/entities/chat-history.entity.js';
import { ChatSession } from '../chat/entities/chat-session.entity.js';
import { Client } from '../client/entities/client.entity.js';
import { OrderModule } from '../order/order.module.js';
import { LeadModule } from '../lead/lead.module.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatHistory, ChatSession, Client]),
    OrderModule,
    LeadModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
