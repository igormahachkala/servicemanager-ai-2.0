import { BadRequestException, Injectable } from '@nestjs/common'
import { WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { UpdateShiftGeoDto } from './dto/update-shift-geo.dto'

export type WorkforceGeoActor = {
  id: string
  companyId: string
}

@Injectable()
export class WorkforceGeoService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMyPoint(actor: WorkforceGeoActor, dto: UpdateShiftGeoDto) {
    const shift = await this.prisma.workShift.findFirst({
      where: {
        companyId: actor.companyId,
        userId: actor.id,
        status: WorkShiftStatus.OPEN,
      },
      select: { id: true },
    })
    if (!shift) {
      throw new BadRequestException('Сначала откройте рабочую смену')
    }

    return this.prisma.workShift.update({
      where: { id: shift.id },
      data: {
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        lastGeoAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
      },
    })
  }
}
