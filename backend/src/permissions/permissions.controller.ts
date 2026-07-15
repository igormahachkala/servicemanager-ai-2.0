import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import {
  AccessDraftPreviewDto,
  RemoveLocationBindingsDto,
  ReplaceAllLocationBindingsDto,
  ReplaceLocationBindingsDto,
  UserPermissionCodesDto,
} from './dto/user-access-management.dto';

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

  @Get('users/access-summary')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'List-ready user access summaries for Access Constructor' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Required for PLATFORM_ADMIN cross-company scope' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'issue', required: false })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  async getAccessSummary(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('issue') issue?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.permissionsService.getAccessSummary({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      q,
      role,
      status,
      issue,
      skip,
      take,
    });
  }

  @Get('users/:userId/effective')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Read effective permissions for a user' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Observer company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'User effective permissions' })
  @ApiForbiddenResponse({ description: 'Only ADMIN and PLATFORM_ADMIN can read permissions' })
  @ApiNotFoundResponse({ description: 'User not found in the readable scope' })
  async getEffective(@Req() req: any, @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('companyId') companyId?: string) {
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
  async getOverrides(@Req() req: any, @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('companyId') companyId?: string) {
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
  async getScopes(@Req() req: any, @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getScopes({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }

  @Post('users/:userId/permissions')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Grant additive per-user permission blocks' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Updated effective permissions for the user' })
  @ApiForbiddenResponse({ description: 'ADMIN can manage only own company and only permissions they effectively have' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async grantUserPermissions(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UserPermissionCodesDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.grantUserPermissions({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      codes: dto.codes,
    });
  }

  @Post('users/:userId/permissions/remove')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Remove additive per-user permission blocks' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Updated effective permissions for the user' })
  @ApiForbiddenResponse({ description: 'ADMIN can manage only own company and only permissions they effectively have' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async removeUserPermissions(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UserPermissionCodesDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.removeUserPermissions({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      codes: dto.codes,
    });
  }

  @Get('users/:userId/location-bindings')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Read user location contour bindings' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'User location bindings' })
  @ApiForbiddenResponse({ description: 'Only ADMIN with USERS_MANAGE and PLATFORM_ADMIN can read bindings' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async getLocationBindings(@Req() req: any, @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getLocationBindings({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }

  @Put('users/:userId/location-bindings')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Replace user location contour bindings for one client contour' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Updated user location bindings' })
  @ApiForbiddenResponse({ description: 'Locations must belong to an allowed client contour' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async replaceLocationBindings(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: ReplaceLocationBindingsDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.replaceLocationBindings({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      locationIds: dto.locationIds,
      clientCompanyId: dto.clientCompanyId,
    });
  }

  @Post('users/:userId/location-bindings/remove')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Remove selected user location contour bindings' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Updated user location bindings' })
  @ApiForbiddenResponse({ description: 'Removing the last binding is blocked in V1A' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async removeLocationBindings(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: RemoveLocationBindingsDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.removeLocationBindings({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      locationIds: dto.locationIds,
      clientCompanyId: dto.clientCompanyId,
    });
  }

  @Put('users/:userId/location-bindings/all')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Grouped body-safe replacement of user location bindings' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Updated user location bindings or unchanged current bindings' })
  @ApiForbiddenResponse({ description: 'Locations must belong to allowed active client contours' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async replaceAllLocationBindings(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: ReplaceAllLocationBindingsDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.replaceAllLocationBindings({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      groups: dto.groups,
    });
  }

  @Get('client-contours')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Read client company contours available to the acting admin/provider' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Provider/client company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Available client contours' })
  async getClientContours(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.permissionsService.getClientContours({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
    });
  }

  @Get('location-options')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Read contour-aware location options for Access Constructor' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Provider/client company scope for PLATFORM_ADMIN' })
  @ApiQuery({ name: 'clientCompanyIds', required: true, description: 'Comma-separated or repeated client company ids' })
  @ApiOkResponse({ description: 'Client/city/location hierarchy' })
  async getLocationOptions(
    @Req() req: any,
    @Query('clientCompanyIds') clientCompanyIds: string | string[],
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.getLocationOptions({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      clientCompanyIds,
    });
  }

  @Get('users/:userId/preview')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Preview user access without side effects' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Read-only access preview' })
  @ApiForbiddenResponse({ description: 'Only ADMIN with USERS_MANAGE and PLATFORM_ADMIN can preview access' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async getAccessPreview(@Req() req: any, @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Query('companyId') companyId?: string) {
    return this.permissionsService.getAccessPreview({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
    });
  }

  @Post('users/:userId/preview-draft')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Preview proposed access changes without writes' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Target company scope for PLATFORM_ADMIN' })
  @ApiOkResponse({ description: 'Read-only draft access preview' })
  @ApiForbiddenResponse({ description: 'Uses the same authorization as write endpoints' })
  @ApiNotFoundResponse({ description: 'User not found in target scope' })
  async previewDraft(
    @Req() req: any,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: AccessDraftPreviewDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.permissionsService.previewDraft({
      actorId: req.user.id,
      actorCompanyId: req.user.companyId,
      actorRole: req.user.role as UserRole,
      requestedCompanyId: companyId,
      userId,
      additivePermissionCodes: dto.additivePermissionCodes,
      locationIds: dto.locationIds,
      selectedClientContourIds: dto.selectedClientContourIds,
    });
  }
}
