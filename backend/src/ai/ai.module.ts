import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { GeminiService } from './providers/gemini.service.js';
import { OpenAiService } from './providers/openai.service.js';
import { SalesAiService } from './sales-ai.service.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [ChatModule],
  controllers: [AiController],
  providers: [AiService, GeminiService, OpenAiService, SalesAiService],
  exports: [AiService, SalesAiService],
})
export class AiModule {}
