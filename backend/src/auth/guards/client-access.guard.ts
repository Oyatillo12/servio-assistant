import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role, User } from '../entities/user.entity.js';

/**
 * Ensures client_admin users can only access their own client data.
 * Reads :id param from the route and compares to user.clientId.
 * Super admins always pass.
 */
@Injectable()
export class ClientAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;

    if (user.role === Role.SUPER_ADMIN) return true;

    const clientId = Number(request.params.id);
    if (clientId && user.clientId !== clientId) {
      throw new ForbiddenException('Access denied to this client');
    }

    return true;
  }
}
