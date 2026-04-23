import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClientModule } from '../client/client.module';
import { ChatModule } from '../chat/chat.module';
import { I18nModule } from '../i18n/i18n.module';
import { FlowModule } from '../flow/flow.module';
import { BotService } from './bot.service';
import { BotUiService } from './bot-ui.service';
import { BotRegistry } from './bot-registry.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { OrderModule } from 'src/order/order.module';
import { LeadModule } from 'src/lead/lead.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    AiModule,
    forwardRef(() => ClientModule),
    forwardRef(() => ChatModule),
    I18nModule,
    forwardRef(() => FlowModule),
    OrderModule,
    LeadModule,
    NotificationModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [BotService, BotUiService, BotRegistry],
  exports: [BotRegistry, BotService],
})
export class BotModule {}
