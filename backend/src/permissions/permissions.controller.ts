import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { PERMISSIONS } from '../common/permissions.constants'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'

import { PermissionsService } from './permissions.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  listUsers(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('hasOverrides') hasOverrides?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.permissionsService.listUsers(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      {
        companyId,
        q,
        role,
        isActive,
        hasOverrides,
        take,
        skip,
      },
    )
  }

  @Get('users/:userId/effective')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  getEffective(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.getEffectivePermissions(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      userId,
      companyId,
    )
  }

  @Get('users/:userId/overrides')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  getOverrides(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.getUserOverrides(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      userId,
      companyId,
    )
  }

  @Get('users/:userId/scopes')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  getScopes(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.getUserScopes(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      userId,
      companyId,
    )
  }

  @Get('users/:userId/audit')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  getAuditHistory(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('companyId') companyId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.permissionsService.getUserPermissionAuditHistory(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      userId,
      {
        companyId,
        take,
        skip,
      },
    )
  }

  @Put('users/:userId/overrides')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  updateOverrides(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { grantPermissionCodes?: string[]; reason?: string },
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.updateUserOverrides(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
      },
      userId,
      {
        grantPermissionCodes: body?.grantPermissionCodes,
        reason: body?.reason,
      },
      companyId,
    )
  }
}
