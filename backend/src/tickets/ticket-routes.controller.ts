import { Body, Controller, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { TicketRouteService } from './ticket-route.service'
import { TicketRoutesDto } from './dto/ticket-routes.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('tickets')
export class TicketRoutesController {
  constructor(private readonly ticketRoute: TicketRouteService) {}

  @Post('routes')
  @HttpCode(200)
  @Roles(
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.PLATFORM_ADMIN,
  )
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  @ApiForbiddenResponse({
    description: 'Missing permission: TICKETS_VIEW',
  })
  getRoutes(
    @Req() req: any,
    @Body() dto: TicketRoutesDto,
    @Query('companyId') companyId?: string,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
  ) {
    return this.ticketRoute.getForTickets(
      {
        id: req.user.id,
        role: req.user.role as UserRole,
        companyId: req.user.companyId,
        accessFlags: req.accessFlags,
      },
      dto.ticketIds,
      linkedClientCompanyId,
      companyId,
    )
  }
}
