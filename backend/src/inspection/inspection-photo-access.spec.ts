import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { UserAccessLocationMode, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { UploadsController } from '../uploads/uploads.controller'

const CLIENT = 'client-company'
const OTHER = 'other-company'
const LOCATION = 'loc-allowed'
const KEY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg'

function makeController(options: {
  attachment?: null | { companyId: string; locationId: string }
  locationMode?: UserAccessLocationMode | null
  boundLocationIds?: string[]
} = {}) {
  const attachment =
    options.attachment === null
      ? null
      : {
          companyId: options.attachment?.companyId ?? CLIENT,
          mimeType: 'image/jpeg',
          originalName: 'round.jpg',
          runItem: { run: { locationId: options.attachment?.locationId ?? LOCATION } },
        }

  const prisma = {
    inspectionRunItemAttachment: { findFirst: jest.fn().mockResolvedValue(attachment) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    userAccessScope: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.locationMode ? { locationMode: options.locationMode } : null),
    },
    userLocationBinding: {
      findMany: jest
        .fn()
        .mockResolvedValue((options.boundLocationIds ?? []).map((id) => ({ locationId: id }))),
    },
  } as any

  const controller = new UploadsController(
    prisma as PrismaService,
    {} as any,
    {} as ServiceContractsService,
  )
  return controller
}

function check(controller: UploadsController, companyId: string, role: UserRole = UserRole.TECHNICIAN) {
  return (controller as any).assertInspectionAttachmentAccess(KEY, {
    sub: 'user-1',
    userId: 'user-1',
    companyId,
    role,
  })
}

describe('Раздача фото обхода', () => {
  it('техник без доступа к локации получает 404', async () => {
    const controller = makeController({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-other'],
    })

    await expect(check(controller, CLIENT, UserRole.TECHNICIAN)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('техник с доступом к локации получает файл', async () => {
    const controller = makeController({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: [LOCATION],
    })

    await expect(check(controller, CLIENT, UserRole.TECHNICIAN)).resolves.toEqual({
      mimeType: 'image/jpeg',
      originalName: 'round.jpg',
    })
  })

  it('подрядчик другой компании по-прежнему не получает файл', async () => {
    const controller = makeController()

    await expect(check(controller, OTHER, UserRole.TECHNICIAN)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
