import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { PermissionsGuard } from '../common/permissions.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { PlannerService } from './planner.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('planner')
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  @Get('me/next')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  @ApiForbiddenResponse({
    description: 'Missing permission: TICKETS_VIEW',
  })
  getMyNext(@Req() req: any) {
    return this.planner.getMyNext({
      companyId: req.user.companyId,
      userId: req.user.id,
      role: req.user.role as UserRole,
      accessFlags: req.accessFlags,
    })
  }
}
