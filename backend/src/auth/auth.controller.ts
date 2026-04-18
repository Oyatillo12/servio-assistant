import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto, ChangePasswordDto } from './dto/reset-password.dto.js';
import { Roles, RolesGuard } from './guards/roles.guard.js';
import { Role, User } from './entities/user.entity.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Request() req: { user: User }) {
    const u = req.user;
    return {
      id: u.id,
      login: u.login,
      email: u.email,
      phone: u.phone,
      role: u.role,
      clientId: u.clientId,
      isActive: u.isActive,
    };
  }

  // ── User management (super admin only) ───────────────────

  @Get('users')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  listUsers() {
    return this.authService.findAll();
  }

  @Post('users')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  /** Super admin resets any user's password */
  @Patch('users/:id/reset-password')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(id, dto.newPassword);
  }

  /** Any authenticated user changes their own password */
  @Patch('users/me/password')
  @UseGuards(AuthGuard('jwt'))
  changePassword(
    @Request() req: { user: User },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /** Super admin toggles isActive for a user */
  @Patch('users/:id/active')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.authService.toggleActive(id);
  }
}
