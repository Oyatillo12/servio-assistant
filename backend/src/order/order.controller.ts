import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role, User } from '../auth/entities/user.entity.js';
import { OrderService } from './order.service.js';
import type { OrderStatus } from './entities/order.entity.js';

@Controller('api/orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Request() req: { user: User }) {
    const clientId =
      req.user.role === Role.CLIENT_ADMIN
        ? (req.user.clientId ?? undefined)
        : undefined;
    return this.orderService.findByClient(clientId!);
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.orderService.findByClient(clientId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: OrderStatus,
  ) {
    return this.orderService.updateStatus(id, status);
  }
}
