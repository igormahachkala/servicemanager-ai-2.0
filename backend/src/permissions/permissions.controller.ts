import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsService } from './permissions.service';
import { PermissionCatalogResponseDto } from './dto/permission-catalog.dto';
import { RoleMatrixResponseDto } from './dto/role-matrix.dto';
import { UpdateMatrixDto } from './dto/update-matrix.dto';

/**
 * Платформа → Роли и права.
 * - catalog/matrix (GET) + matrix save (PATCH): только PLATFORM_ADMIN (integration).
 * - users/* (read-only эффективные права): ADMIN + PLATFORM_ADMIN (readonly perm API).
 * @Roles перенесён на уровень методов — у двух групп роутов разный набор ролей.
 */
@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ── Каталог + матрица ролей (integration) — только PLATFORM_ADMIN ──

  @Get('catalog')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Справочник всех permission-блоков',
    description:
      'Возвращает каталог доступных прав (code = реальный PermissionBlock.code, UPPER_SNAKE). Только чтение, только PLATFORM_ADMIN.',
  })
  @ApiOkResponse({ type: PermissionCatalogResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  getCatalog(): PermissionCatalogResponseDto {
    return { blocks: this.permissionsService.getCatalog() };
  }

  @Get('matrix')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Матрица ролей (role + companyType → permissions)',
    description:
      'Возвращает матрицу прав из БД (RolePermission). companyType=null — wildcard. Fallback на статическую матрицу только если PBAC не засеян. Только чтение, только PLATFORM_ADMIN.',
  })
  @ApiOkResponse({ type: RoleMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  async getMatrix(): Promise<RoleMatrixResponseDto> {
    return { roles: await this.permissionsService.getMatrix() };
  }

  @Patch('matrix')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Сохранить изменения матрицы (add/remove дельты)',
    description:
      'Применяет дельты к RolePermission в транзакции, с валидацией против каталога, lockout-protection для PLATFORM_ADMIN и аудитом (DomainEvent permissions.matrix_updated). Только PLATFORM_ADMIN. Идемпотентно. Возвращает обновлённую матрицу.',
  })
  @ApiOkResponse({ type: RoleMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  async updateMatrix(@Req() req: any, @Body() dto: UpdateMatrixDto): Promise<RoleMatrixResponseDto> {
    const actor = { id: req.user.id, companyId: req.user.companyId };
    const roles = await this.permissionsService.applyChanges(dto.changes, actor);
    return { roles };
  }

  // ── Read-only эффективные права по пользователю (readonly) — ADMIN + PLATFORM_ADMIN ──

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
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
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
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
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
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
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
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
