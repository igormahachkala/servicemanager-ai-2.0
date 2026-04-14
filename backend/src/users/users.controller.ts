import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UpdateUserSpecializationsDto } from './dto/update-user-specializations.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(UserRole.ADMIN, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Get()
  list(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.users.list(req.user.companyId, req.user.role as UserRole, companyId)
  }

  @Roles(UserRole.ADMIN, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Post()
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.users.create(req.user.companyId, req.user.id, req.user.role as UserRole, dto)
  }

  @Roles(UserRole.ADMIN, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Patch(':id')
  update(@Req() req: any, @Param('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.update(req.user.companyId, req.user.id, req.user.role as UserRole, userId, dto)
  }

  @Roles(UserRole.ADMIN, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Patch(':id/deactivate')
  deactivate(@Req() req: any, @Param('id') userId: string) {
    return this.users.deactivate(req.user.companyId, req.user.id, req.user.role as UserRole, userId)
  }

  @Roles(UserRole.ADMIN, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Patch(':id/activate')
  activate(@Req() req: any, @Param('id') userId: string) {
    return this.users.activate(req.user.companyId, req.user.id, req.user.role as UserRole, userId)
  }

  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  @Put(':id/specializations')
  updateSpecializations(@Req() req: any, @Param('id') userId: string, @Body() dto: UpdateUserSpecializationsDto) {
    return this.users.updateSpecializations(req.user.companyId, userId, dto.specializationIds ?? [])
  }
}