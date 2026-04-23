import { Module, forwardRef } from '@nestjs/common';
import { ClientModule } from '../client/client.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { OrderModule } from '../order/order.module.js';
import { LeadModule } from '../lead/lead.module.js';
import { BotModule } from '../bot/bot.module.js';
import { FlowStateService } from './flow-state.service.js';
import { FlowRouterService } from './flow-router.service.js';
import { OrderFlowService } from './order-flow.service.js';
import { LeadFlowService } from './lead-flow.service.js';

@Module({
  imports: [
    ClientModule,
    AiModule,
    ChatModule,
    OrderModule,
    LeadModule,
    forwardRef(() => BotModule),
  ],
  providers: [
    FlowStateService,
    FlowRouterService,
    OrderFlowService,
    LeadFlowService,
  ],
  exports: [FlowRouterService, FlowStateService],
})
export class FlowModule {}
