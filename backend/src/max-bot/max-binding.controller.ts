import { Body, Controller, Delete, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { CreateMaxBindingDto } from './dto/create-max-binding.dto';
import { RevokeMaxBindingDto } from './dto/revoke-max-binding.dto';
import { MaxBindingService } from './max-binding.service';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * Binding management for the signed-in user.
 *
 * Authentication is the ordinary stack — `JwtAuthGuard` + `RolesGuard`. Every role is listed:
 * binding is identity, not privilege.
 *
 * Create still only binds the JWT user. Revoke with Mini App initData unlinks this MAX
 * account, including a row owned by another SMA user: that is «Выйти» in this chat, not
 * an admin acting on someone else's id.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
  UserRole.CLIENT_ADMIN,
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

  /** Unlink this SMA user, and this MAX account when initData is present. Idempotent. */
  @Delete()
  async revoke(@Req() req: any, @Body() dto: RevokeMaxBindingDto = new RevokeMaxBindingDto()) {
    return this.bindings.revokeBinding(req.user.id, dto?.initData);
  }
}
