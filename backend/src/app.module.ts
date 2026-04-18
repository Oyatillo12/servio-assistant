import { Module, OnModuleInit } from '@nestjs/common';
import { DemoSeederService } from './database/demo.seeder.js';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotModule } from './bot/bot.module.js';
import { AiModule } from './ai/ai.module.js';
import { ClientModule } from './client/client.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AuthModule } from './auth/auth.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { OrderModule } from './order/order.module.js';
import { LeadModule } from './lead/lead.module.js';
import { NotificationModule } from './notification/notification.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'ai_bot',
      autoLoadEntities: true,
      // In production set DB_SYNC=false and run `pnpm migration:run`
      synchronize: process.env.DB_SYNC !== 'false',
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: false, // run manually via CLI
    }),

    // Rate limiting: 60 requests per minute per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    I18nModule,
    AuthModule,
    AiModule,
    ClientModule,
    ChatModule,
    AnalyticsModule,
    OrderModule,
    LeadModule,
    NotificationModule,
    BotModule,
  ],
  providers: [DemoSeederService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly demoSeeder: DemoSeederService) {}

  async onModuleInit() {
    await this.demoSeeder.seed();
  }
}
