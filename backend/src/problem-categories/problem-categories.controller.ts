import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
import { ProblemCategoriesService } from './problem-categories.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('problem-categories')
export class ProblemCategoriesController {
  constructor(private svc: ProblemCategoriesService) {}

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
    @Body() body: { specializationIds: string[] },
  ) {
    return this.svc.setSpecializations(req.user.companyId, id, body.specializationIds || []);
  }
}
