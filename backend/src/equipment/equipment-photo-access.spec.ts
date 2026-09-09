import { NotFoundException } from '@nestjs/common'
import { UserAccessLocationMode, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { UploadsController } from '../uploads/uploads.controller'

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Спека лежит рядом с модулем оборудования, а не в src/uploads: корневой
 * .gitignore игнорирует любой путь uploads/, и новый файл там просто не попал бы
 * в коммит.
 *
 * Снимок оборудования не лежит в публичном каталоге: он раздаётся тем же
 * авторизованным маршрутом, что и остальные вложения. Проверяется, что видит
 * его ровно тот, кто видит саму единицу.
 */

const CLIENT = 'client-company'
const PROVIDER = 'provider-company'
const OTHER = 'other-company'
const LOCATION = 'loc-allowed'
const KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'

function makeController(options: {
  attachmentCompanyId?: string | null
  contract?: unknown
  locationMode?: UserAccessLocationMode | null
  boundLocationIds?: string[]
} = {}) {
  const attachment =
    options.attachmentCompanyId === null
      ? null
      : {
          companyId: options.attachmentCompanyId ?? CLIENT,
          mimeType: 'image/jpeg',
          originalName: 'boiler.jpg',
          equipment: { locationId: LOCATION },
        }

  const prisma = {
    equipmentAttachment: { findFirst: jest.fn().mockResolvedValue(attachment) },
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

  const contracts = {
    getLinkedClientAccess: jest
      .fn()
      .mockResolvedValue('contract' in options ? options.contract : { role: 'PRIMARY', status: 'ACTIVE' }),
  } as any

  const controller = new UploadsController(
    prisma as PrismaService,
    {} as any,
    contracts as ServiceContractsService,
  )
  return { controller, prisma, contracts }
}

function check(controller: UploadsController, companyId: string, role: UserRole = UserRole.ADMIN) {
  return (controller as any).assertEquipmentAttachmentAccess(KEY, {
    sub: 'user-1',
    userId: 'user-1',
    companyId,
    role,
  })
}

describe('Раздача снимков оборудования', () => {
  it('свой tenant получает файл', async () => {
    const { controller } = makeController()

    await expect(check(controller, CLIENT)).resolves.toEqual({
      mimeType: 'image/jpeg',
      originalName: 'boiler.jpg',
    })
  })

  it('чужой tenant без договора получает 404, а не 403 — существование файла не подтверждается', async () => {
    const { controller } = makeController({ contract: null })

    await expect(check(controller, OTHER)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('провайдер с действующим договором получает файл через канонический резолвер', async () => {
    const { controller, contracts } = makeController()

    await expect(check(controller, PROVIDER, UserRole.MASTER)).resolves.toMatchObject({
      mimeType: 'image/jpeg',
    })
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(PROVIDER, CLIENT)
  })

  it('площадка вне области пользователя закрывает и снимок', async () => {
    const { controller } = makeController({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-other'],
    })

    await expect(check(controller, CLIENT)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('привязка к нужной площадке доступ открывает', async () => {
    const { controller } = makeController({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: [LOCATION],
    })

    await expect(check(controller, CLIENT)).resolves.toMatchObject({ mimeType: 'image/jpeg' })
  })

  it('неизвестный файл — 404, договор при этом не запрашивается', async () => {
    const { controller, contracts } = makeController({ attachmentCompanyId: null })

    await expect(check(controller, PROVIDER)).rejects.toBeInstanceOf(NotFoundException)
    expect(contracts.getLinkedClientAccess).not.toHaveBeenCalled()
  })

  it('PLATFORM_ADMIN не проходит через договор', async () => {
    const { controller, contracts } = makeController({ attachmentCompanyId: OTHER })

    await expect(check(controller, PROVIDER, UserRole.PLATFORM_ADMIN)).resolves.toMatchObject({
      mimeType: 'image/jpeg',
    })
    expect(contracts.getLinkedClientAccess).not.toHaveBeenCalled()
  })
})
