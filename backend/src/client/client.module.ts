import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity.js';
import { Product } from './entities/product.entity.js';
import { Service } from './entities/service.entity.js';
import { ClientService } from './client.service.js';
import { ClientController } from './client.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { BotModule } from '../bot/bot.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Product, Service]),
    forwardRef(() => AuthModule),
    forwardRef(() => BotModule),
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
