import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsService } from './permissions.service';
import { PermissionCatalogResponseDto } from './dto/permission-catalog.dto';
import { RoleMatrixResponseDto } from './dto/role-matrix.dto';
import { UpdateMatrixDto } from './dto/update-matrix.dto';

/**
 * Платформа → Роли и права. Доступ только PLATFORM_ADMIN.
 * GET — чтение (catalog + DB-backed matrix). PATCH — сохранение дельт (транзакция + аудит).
 */
@ApiTags('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  @Get('catalog')
  @ApiOperation({
    summary: 'Справочник всех permission-блоков',
    description:
      'Возвращает каталог доступных прав (code = реальный PermissionBlock.code, UPPER_SNAKE). Только чтение, только PLATFORM_ADMIN.',
  })
  @ApiOkResponse({ type: PermissionCatalogResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  getCatalog(): PermissionCatalogResponseDto {
    return { blocks: this.svc.getCatalog() };
  }

  @Get('matrix')
  @ApiOperation({
    summary: 'Матрица ролей (role + companyType → permissions)',
    description:
      'Возвращает матрицу прав из БД (RolePermission). companyType=null — wildcard. Fallback на статическую матрицу только если PBAC не засеян. Только чтение, только PLATFORM_ADMIN.',
  })
  @ApiOkResponse({ type: RoleMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  async getMatrix(): Promise<RoleMatrixResponseDto> {
    return { roles: await this.svc.getMatrix() };
  }

  @Patch('matrix')
  @ApiOperation({
    summary: 'Сохранить изменения матрицы (add/remove дельты)',
    description:
      'Применяет дельты к RolePermission в транзакции, с валидацией против каталога, lockout-protection для PLATFORM_ADMIN и аудитом (DomainEvent permissions.matrix_updated). Только PLATFORM_ADMIN. Идемпотентно. Возвращает обновлённую матрицу.',
  })
  @ApiOkResponse({ type: RoleMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  async updateMatrix(@Req() req: any, @Body() dto: UpdateMatrixDto): Promise<RoleMatrixResponseDto> {
    const actor = { id: req.user.id, companyId: req.user.companyId };
    const roles = await this.svc.applyChanges(dto.changes, actor);
    return { roles };
  }
}
