import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role, User } from '../auth/entities/user.entity.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('api/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  dashboard(
    @Request() req: { user: User },
    @Query('clientId') clientIdStr?: string,
  ) {
    const clientId =
      req.user.role === Role.CLIENT_ADMIN
        ? (req.user.clientId ?? undefined)
        : clientIdStr
          ? Number(clientIdStr)
          : undefined;
    return this.analyticsService.getDashboard(clientId);
  }

  @Get('clients/:id/messages')
  messages(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getClientMessages(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}
