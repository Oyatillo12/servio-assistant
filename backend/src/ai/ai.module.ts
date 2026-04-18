import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';

@Module({
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService], // Exported so BotModule can use it
})
export class AiModule {}
