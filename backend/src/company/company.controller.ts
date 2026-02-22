import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UserRole } from '@prisma/client';
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
  @Patch('auto-assign')
  setAutoAssign(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.svc.setAutoAssign(req.user.companyId, !!body.enabled);
  }
}
