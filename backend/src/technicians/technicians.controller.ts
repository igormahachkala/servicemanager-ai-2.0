import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
import { TechniciansService } from './technicians.service';
import { SetTechnicianSpecializationsDto } from './dto/set-technician-specializations.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('technicians')
export class TechniciansController {
  constructor(private svc: TechniciansService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.companyId);
  }

  @Put(':id/specializations')
  setSpecializations(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetTechnicianSpecializationsDto,
  ) {
    return this.svc.setSpecializations(req.user.companyId, id, dto.specializationIds || []);
  }
}
