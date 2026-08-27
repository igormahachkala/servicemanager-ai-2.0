import { Body, Controller, Delete, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { CreateMaxBindingDto } from './dto/create-max-binding.dto';
import { MaxBindingService } from './max-binding.service';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * Binding management for the signed-in user, and only for the signed-in user.
 *
 * Authentication is the ordinary stack — `JwtAuthGuard` + `RolesGuard`, tenant from
 * `req.user` — because the ServiceManager half of the ceremony IS an ordinary session.
 * Every role is listed: binding is identity, not privilege, so a technician has exactly as
 * much right to link their own MAX account as an admin does.
 *
 * There is no endpoint that binds, reads or revokes on behalf of another user. Adding one
 * would create an administrative path to impersonation, and the whole point of the ceremony
 * is that only the person holding both credentials can create the link.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.STAFF,
  UserRole.PLATFORM_ADMIN,
)
@Controller('max/binding')
export class MaxBindingController {
  constructor(private readonly bindings: MaxBindingService) {}

  /** Current binding for the caller, or `{ binding: null }`. Masked identifier only. */
  @Get()
  async current(@Req() req: any) {
    const binding = await this.bindings.getBinding(req.user.id);
    return { binding };
  }

  /**
   * Complete the ceremony.
   *
   * The deny reason is returned in a stable `code` so the Mini App can render precise UX,
   * while the HTTP status stays a flat 403 for every failure: distinguishing "wrong
   * signature" from "that MAX account belongs to someone else" by status code would let an
   * unauthenticated prober map which MAX accounts exist.
   */
  @Post()
  async create(@Req() req: any, @Body() dto: CreateMaxBindingDto) {
    const result = await this.bindings.createBinding(req.user.id, dto.initData);
    if (!result.ok) {
      throw new ForbiddenException({ code: 'MAX_BINDING_DENIED', reason: result.reason });
    }
    return { created: result.created, binding: result.binding };
  }

  /** Unlink. Idempotent — safe to call when nothing is bound. */
  @Delete()
  async revoke(@Req() req: any) {
    return this.bindings.revokeBinding(req.user.id);
  }
}
