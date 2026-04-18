import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ClientModule } from '../client/client.module';
import { ChatModule } from '../chat/chat.module';
import { I18nModule } from '../i18n/i18n.module';
import { FlowModule } from '../flow/flow.module';
import { BotService } from './bot.service';
import { BotUiService } from './bot-ui.service';
import { OrderModule } from 'src/order/order.module';
import { LeadModule } from 'src/lead/lead.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    AiModule,
    ClientModule,
    ChatModule,
    I18nModule,
    FlowModule,
    OrderModule,
    LeadModule,
    NotificationModule,
  ],
  providers: [BotService, BotUiService],
})
export class BotModule {}
