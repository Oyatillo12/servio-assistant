import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module.js';
import { BotModule } from '../bot/bot.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { ChatSession } from '../chat/entities/chat-session.entity.js';
import { ClientModule } from '../client/client.module.js';
import { RecoveryService } from './recovery.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession]),
    ChatModule,
    AiModule,
    ClientModule,
    BotModule,
  ],
  providers: [RecoveryService],
})
export class RecoveryModule {}
