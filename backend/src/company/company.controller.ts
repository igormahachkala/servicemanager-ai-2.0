import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyService } from './company.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company')
export class CompanyController {
  constructor(private svc: CompanyService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  get(@Req() req: any) {
    return this.svc.get(req.user.companyId);
  }

  @Roles(UserRole.ADMIN)
  @Patch()
  update(@Req() req: any, @Body() dto: UpdateCompanyDto) {
    return this.svc.update(req.user.companyId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('auto-assign')
  setAutoAssign(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.svc.setAutoAssign(req.user.companyId, !!body.enabled);
  }
}
