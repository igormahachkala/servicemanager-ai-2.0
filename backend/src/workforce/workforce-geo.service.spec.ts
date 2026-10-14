import { BadRequestException } from '@nestjs/common'
import { UserRole, WorkShiftStatus } from '@prisma/client'

import { WorkforceGeoService } from './workforce-geo.service'

const actor = { id: 'tech-1', companyId: 'provider-1', role: UserRole.TECHNICIAN }

function makePrisma() {
  return {
    workShift: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
  } as any
}

describe('WorkforceGeoService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('updates last geo on the actor open shift', async () => {
    const prisma = makePrisma()
    const opened = { id: 'shift-open' }
    const updated = {
      id: 'shift-open',
      lastLatitude: 55.75,
      lastLongitude: 37.62,
      lastGeoAt: new Date('2026-10-13T10:00:00.000Z'),
    }
    prisma.workShift.findFirst.mockResolvedValue(opened)
    prisma.workShift.update.mockResolvedValue(updated)
    const service = new WorkforceGeoService(prisma)

    const result = await service.updateMyPoint(actor, {
      latitude: 55.75,
      longitude: 37.62,
      capturedAt: '2026-10-13T10:00:00.000Z',
    })

    expect(prisma.workShift.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: actor.companyId,
        userId: actor.id,
        status: WorkShiftStatus.OPEN,
      },
      select: { id: true },
    })
    expect(prisma.workShift.update).toHaveBeenCalledWith({
      where: { id: 'shift-open' },
      data: {
        lastLatitude: 55.75,
        lastLongitude: 37.62,
        lastGeoAt: new Date('2026-10-13T10:00:00.000Z'),
      },
    })
    expect(result).toEqual(updated)
  })

  it('rejects when the actor has no open shift', async () => {
    const prisma = makePrisma()
    const service = new WorkforceGeoService(prisma)

    await expect(
      service.updateMyPoint(actor, { latitude: 55.75, longitude: 37.62 }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.updateMyPoint(actor, { latitude: 55.75, longitude: 37.62 }),
    ).rejects.toMatchObject({ message: 'Сначала откройте рабочую смену' })
    expect(prisma.workShift.update).not.toHaveBeenCalled()
  })

  it('cannot update by inventing shiftId — only the actor open shift is written', async () => {
    const prisma = makePrisma()
    prisma.workShift.findFirst.mockResolvedValue({ id: 'shift-open' })
    prisma.workShift.update.mockResolvedValue({ id: 'shift-open' })
    const service = new WorkforceGeoService(prisma)

    await service.updateMyPoint(actor, {
      latitude: 10,
      longitude: 20,
      shiftId: 'forged-shift',
    } as any)

    const findWhere = prisma.workShift.findFirst.mock.calls[0][0].where
    expect(findWhere).toEqual({
      companyId: actor.companyId,
      userId: actor.id,
      status: WorkShiftStatus.OPEN,
    })
    expect(findWhere.id).toBeUndefined()
    expect(prisma.workShift.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'shift-open' } }),
    )
    expect(prisma.workShift.update.mock.calls[0][0].where.id).not.toBe('forged-shift')
  })
})
