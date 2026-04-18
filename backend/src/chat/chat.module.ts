import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatHistory } from './entities/chat-history.entity.js';
import { ChatSession } from './entities/chat-session.entity.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ChatHistory, ChatSession])],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
