import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users with effective permissions for a company scope' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Observer company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Company users and their permission summary' })
  @ApiForbiddenResponse({ description: 'Only ADMIN and PLATFORM_ADMIN can read permissions' })
  async listUsers(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.permissionsService.listUsers({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
    });
  }

  @Get('users/:userId/effective')
  @ApiOperation({ summary: 'Read effective permissions for a user' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Observer company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'User effective permissions' })
  @ApiForbiddenResponse({ description: 'Only ADMIN and PLATFORM_ADMIN can read permissions' })
  @ApiNotFoundResponse({ description: 'User not found in the readable scope' })
  async getEffective(@Req() req: any, @Param('userId') userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getEffectivePermissions({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }

  @Get('users/:userId/overrides')
  @ApiOperation({ summary: 'Read direct per-user permission overrides' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Observer company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'User overrides' })
  @ApiForbiddenResponse({ description: 'Only ADMIN and PLATFORM_ADMIN can read permissions' })
  @ApiNotFoundResponse({ description: 'User not found in the readable scope' })
  async getOverrides(@Req() req: any, @Param('userId') userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getOverrides({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }

  @Get('users/:userId/scopes')
  @ApiOperation({ summary: 'Read scoped permission flags for a user' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Observer company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'User scope summary' })
  @ApiForbiddenResponse({ description: 'Only ADMIN and PLATFORM_ADMIN can read permissions' })
  @ApiNotFoundResponse({ description: 'User not found in the readable scope' })
  async getScopes(@Req() req: any, @Param('userId') userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getScopes({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }
}
