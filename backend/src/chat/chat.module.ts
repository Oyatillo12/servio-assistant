import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatHistory } from './entities/chat-history.entity.js';
import { ChatSession } from './entities/chat-session.entity.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { BotModule } from '../bot/bot.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatHistory, ChatSession]),
    forwardRef(() => AuthModule),
    forwardRef(() => BotModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
