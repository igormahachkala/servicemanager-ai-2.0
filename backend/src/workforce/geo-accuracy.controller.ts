import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { PatchPlatformArrivalSettingsDto } from './dto/patch-platform-arrival-settings.dto'
import { GeoAccuracyService } from './geo-accuracy.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller()
export class GeoAccuracyController {
  constructor(private readonly geoAccuracy: GeoAccuracyService) {}

  @Get('platform/geo-accuracy/buckets')
  buckets() {
    return this.geoAccuracy.listBuckets()
  }

  @Get('platform/geo-accuracy/cells')
  cells(@Query('companyId') companyId?: string) {
    return this.geoAccuracy.listCells(companyId)
  }

  @Get('platform/geo-accuracy/settings')
  getSettings() {
    return this.geoAccuracy.getSettings()
  }

  @Patch('platform/geo-accuracy/settings')
  patchSettings(@Body() dto: PatchPlatformArrivalSettingsDto) {
    return this.geoAccuracy.patchSettings(dto)
  }
}
