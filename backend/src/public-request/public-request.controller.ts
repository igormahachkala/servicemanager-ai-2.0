import { Body, Controller, Get, Param, Post, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'

import { PublicRequestService } from './public-request.service'
import { PublicTokenQueryDto } from './dto/public-token-query.dto'
import { CreatePublicRequestDto } from './dto/create-public-request.dto'
import { PublicRequestContextQueryDto } from './dto/public-request-context-query.dto'

@Controller('public/request')
export class PublicRequestController {
  constructor(private readonly svc: PublicRequestService) {}

  @Get('context/:token')
  getContext(@Param('token') token: string, @Query() query: PublicRequestContextQueryDto) {
    return this.svc.getContext(token, query.locationId)
  }

  @Get('locations/:token')
  getLocations(@Param('token') token: string, @Query('q') q?: string) {
    return this.svc.getLocations(token, q)
  }

  @Get('locations/:locationId/equipment')
  getEquipment(@Param('locationId') locationId: string, @Query() query: PublicTokenQueryDto) {
    return this.svc.getLocationEquipment(query.token, locationId)
  }

  @Post(':token')
  @UseInterceptors(FilesInterceptor('photos', 3))
  create(
    @Param('token') token: string,
    @Body() dto: CreatePublicRequestDto,
    @UploadedFiles() files: any[],
    @Req() req: any,
  ) {
    return this.svc.create(token, dto, files || [], req)
  }
}
