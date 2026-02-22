import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SpecializationsService } from './specializations.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
import { CreateSpecializationDto } from './dto/create-specialization.dto';
import { UpdateSpecializationDto } from './dto/update-specialization.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('specializations')
export class SpecializationsController {
  constructor(private svc: SpecializationsService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.companyId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSpecializationDto) {
    return this.svc.create(req.user.companyId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSpecializationDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  @Patch(':id/status')
  setStatus(@Req() req: any, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.svc.setStatus(req.user.companyId, id, !!body.isActive);
  }
}
