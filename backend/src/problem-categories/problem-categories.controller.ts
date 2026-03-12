import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { ProblemCategoriesService } from './problem-categories.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';
import { SetProblemCategorySpecializationsDto } from './dto/set-problem-category-specializations.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
@RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
@Controller('problem-categories')
export class ProblemCategoriesController {
  constructor(private readonly svc: ProblemCategoriesService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.companyId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateProblemCategoryDto) {
    return this.svc.create(req.user.companyId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProblemCategoryDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  @Patch(':id/status')
  setStatus(@Req() req: any, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.svc.setStatus(req.user.companyId, id, !!body.isActive);
  }

  @Put(':id/specializations')
  setSpecializations(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetProblemCategorySpecializationsDto,
  ) {
    return this.svc.setSpecializations(req.user.companyId, id, dto.specializationIds ?? []);
  }
}
