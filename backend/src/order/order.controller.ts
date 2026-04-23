import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role, User } from '../auth/entities/user.entity.js';
import { OrderService } from './order.service.js';
import type { Order, OrderStatus } from './entities/order.entity.js';
import { toCsv } from '../common/utils/csv.util.js';

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

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orders.csv"')
  async exportCsv(
    @Request() req: { user: User },
    @Query('clientId') clientIdStr?: string,
  ): Promise<string> {
    const clientId = this.resolveClientId(req.user, clientIdStr);
    const orders = await this.orderService.findByClient(clientId!);
    return toCsv(orders, [
      { header: 'id', get: (o) => o.id },
      { header: 'created_at', get: (o) => o.createdAt },
      { header: 'status', get: (o) => o.status },
      { header: 'phone', get: (o) => o.phone },
      { header: 'address', get: (o) => o.address ?? '' },
      {
        header: 'items',
        get: (o: Order) =>
          o.items
            .map((i) => `${i.productName} x${i.quantity}`)
            .join('; '),
      },
      {
        header: 'total',
        get: (o: Order) =>
          o.items.reduce(
            (sum, i) => sum + (i.price != null ? Number(i.price) * i.quantity : 0),
            0,
          ),
      },
    ]);
  }

  @Get('client/:clientId')
  findByClient(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Request() req: { user: User },
  ) {
    this.assertClientAccess(req.user, clientId);
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

  // ── Helpers ──────────────────────────────────────────────

  private resolveClientId(user: User, explicit?: string): number | undefined {
    if (user.role === Role.CLIENT_ADMIN) return user.clientId ?? undefined;
    return explicit ? Number(explicit) : undefined;
  }

  private assertClientAccess(user: User, clientId: number): void {
    if (user.role === Role.CLIENT_ADMIN && user.clientId !== clientId) {
      throw new ForbiddenException('Cross-client access denied');
    }
  }
}
