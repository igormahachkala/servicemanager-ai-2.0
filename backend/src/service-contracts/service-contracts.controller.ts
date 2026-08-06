import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'

import { CreateServiceContractDto } from './dto/create-service-contract.dto'
import { UpdateServiceContractDto } from './dto/update-service-contract.dto'
import { ServiceContractsService } from './service-contracts.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ServiceContractsController {
  constructor(private readonly svc: ServiceContractsService) {}

  @Get('service-contracts/linked-clients')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  linkedClients(@Req() req: any) {
    return this.svc.listLinkedClients(req?.user?.companyId)
  }

  @Get('service-contracts/linked-providers')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  linkedProviders(@Req() req: any) {
    return this.svc.listLinkedProviders(req?.user?.companyId)
  }

  @Get('service-contracts')
  @Roles(UserRole.PLATFORM_ADMIN)
  listAll() {
    return this.svc.listAll()
  }

  @Get('service-contracts/:id')
  @Roles(UserRole.PLATFORM_ADMIN)
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id)
  }

  @Post('service-contracts')
  @Roles(UserRole.PLATFORM_ADMIN)
  create(@Req() req: any, @Body() dto: CreateServiceContractDto) {
    return this.svc.create(dto, req?.user?.id)
  }

  @Patch('service-contracts/:id')
  @Roles(UserRole.PLATFORM_ADMIN)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceContractDto) {
    return this.svc.update(id, dto, req?.user?.id)
  }

  @Get('companies/:id/service-contracts')
  @Roles(UserRole.PLATFORM_ADMIN)
  listForCompany(@Param('id') companyId: string) {
    return this.svc.listForCompany(companyId)
  }
}
