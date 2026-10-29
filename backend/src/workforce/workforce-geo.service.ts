import { BadRequestException, Injectable } from '@nestjs/common'
import { WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { UpdateShiftGeoDto } from './dto/update-shift-geo.dto'
import { recordGeoAccuracyPoint } from './geo-accuracy.service'
import { WorkforceOnSiteService } from './workforce-on-site.service'

export type WorkforceGeoActor = {
  id: string
  companyId: string
}

@Injectable()
export class WorkforceGeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onSite: WorkforceOnSiteService,
  ) {}

  async updateMyPoint(actor: WorkforceGeoActor, dto: UpdateShiftGeoDto) {
    const shift = await this.prisma.workShift.findFirst({
      where: {
        companyId: actor.companyId,
        userId: actor.id,
        status: WorkShiftStatus.OPEN,
      },
      select: { id: true, companyId: true },
    })
    if (!shift) {
      throw new BadRequestException('Сначала откройте рабочую смену')
    }

    const receivedAt = new Date()
    const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : receivedAt
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workShift.update({
        where: { id: shift.id },
        data: {
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastGeoAt: capturedAt,
        },
      })
      await recordGeoAccuracyPoint(tx, {
        companyId: shift.companyId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        recordedAt: capturedAt,
      })
      return row
    })
    await this.onSite.onGeoPoint({
      companyId: actor.companyId,
      userId: actor.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      capturedAt,
      accuracy: dto.accuracy == null ? null : dto.accuracy,
      receivedAt,
    })
    return updated
  }
}
