import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsService } from './permissions.service';
import { PermissionCatalogResponseDto } from './dto/permission-catalog.dto';
import { RoleMatrixResponseDto } from './dto/role-matrix.dto';

/**
 * Read-only API-фундамент для будущего экрана «Платформа → Роли и права».
 * Доступ только PLATFORM_ADMIN. Никаких мутаций.
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
      'Возвращает дефолтную матрицу прав по ключу (role, companyType). companyType=null — wildcard. Только чтение, только PLATFORM_ADMIN.',
  })
  @ApiOkResponse({ type: RoleMatrixResponseDto })
  @ApiForbiddenResponse({ description: 'Доступно только PLATFORM_ADMIN' })
  getMatrix(): RoleMatrixResponseDto {
    return { roles: this.svc.getMatrix() };
  }
}
