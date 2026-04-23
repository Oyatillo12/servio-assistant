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
import { LeadService } from './lead.service.js';
import type { LeadStatus } from './entities/lead.entity.js';
import { toCsv } from '../common/utils/csv.util.js';

@Controller('api/leads')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get()
  findAll(@Request() req: { user: User }) {
    const clientId =
      req.user.role === Role.CLIENT_ADMIN
        ? (req.user.clientId ?? undefined)
        : undefined;
    return this.leadService.findByClient(clientId!);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leads.csv"')
  async exportCsv(
    @Request() req: { user: User },
    @Query('clientId') clientIdStr?: string,
  ): Promise<string> {
    const clientId = this.resolveClientId(req.user, clientIdStr);
    const leads = await this.leadService.findByClient(clientId!);
    return toCsv(leads, [
      { header: 'id', get: (l) => l.id },
      { header: 'created_at', get: (l) => l.createdAt },
      { header: 'status', get: (l) => l.status },
      { header: 'name', get: (l) => l.name },
      { header: 'phone', get: (l) => l.phone },
      { header: 'notes', get: (l) => l.notes ?? '' },
    ]);
  }

  @Get('client/:clientId')
  findByClient(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Request() req: { user: User },
  ) {
    this.assertClientAccess(req.user, clientId);
    return this.leadService.findByClient(clientId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leadService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: LeadStatus,
  ) {
    return this.leadService.updateStatus(id, status);
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
