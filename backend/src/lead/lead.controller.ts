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
import { LeadService } from './lead.service.js';
import type { LeadStatus } from './entities/lead.entity.js';

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

  @Get('client/:clientId')
  findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
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
}
