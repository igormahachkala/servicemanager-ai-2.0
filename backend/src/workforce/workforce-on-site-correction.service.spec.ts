import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { PERMISSIONS } from '../common/permissions.constants'
import { WorkforceController } from './workforce.controller'
import { WorkforceOnSiteCorrectionService } from './workforce-on-site-correction.service'

const master = { id: 'master-1', companyId: 'provider-1', role: UserRole.MASTER }
const technician = { id: 'tech-actor', companyId: 'provider-1', role: UserRole.TECHNICIAN }
const clientAdmin = { id: 'admin-client', companyId: 'client-1', role: UserRole.ADMIN }
const ARRIVED = new Date('2026-10-27T07:01:00.000Z')
const DEPARTED = new Date('2026-10-27T09:00:00.000Z')

function makePrisma(options: { companyType: CompanyType; withArrival?: boolean }) {
  const arrivals: any[] = []
  const corrections: any[] = []
  const events: any[] = []
  if (options.withArrival !== false) {
    arrivals.push({
      id: 'arr-1',
      companyId: 'provider-1',
      ticketId: 'ticket-1',
      userId: 'tech-1',
      arrivedAt: ARRIVED,
      departedAt: DEPARTED,
      lastDistanceMeters: 40,
      candidateStreak: 2,
    })
  }

  const prisma = {
    company: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id !== 'provider-1' && where.id !== 'client-1') return null
        if (where.id === 'client-1') return { type: CompanyType.CLIENT, timezone: 'UTC' }
        return { type: options.companyType, timezone: 'Asia/Krasnoyarsk' }
      }),
    },
    ticket: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id !== 'ticket-1') return null
        if (!where.status.in.includes('ASSIGNED') && !where.status.in.includes('IN_PROGRESS')) return null
        const technicianCompany = where.assignedTechnician?.companyId
        if (technicianCompany !== 'provider-1') return null
        if (where.companyId && where.companyId !== 'client-9') return null
        return {
          id: 'ticket-1',
          companyId: 'client-9',
          status: 'ASSIGNED',
          assignedTechnicianId: 'tech-1',
        }
      }),
      update: jest.fn(),
    },
    workLog: { update: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    ticketComment: { create: jest.fn() },
    technicianArrival: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.ticketId_userId
        if (key) {
          return arrivals.find((row) => row.ticketId === key.ticketId && row.userId === key.userId) ?? null
        }
        return arrivals.find((row) => row.id === where.id) ?? null
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: 'arr-new', arrivedAt: null, departedAt: null, lastDistanceMeters: null, ...data }
        arrivals.push(row)
        return row
      }),
      update: jest.fn(async () => {
        throw new Error('automatic arrivedAt and departedAt must stay')
      }),
    },
    technicianArrivalCorrection: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `corr-${corrections.length + 1}`,
          createdAt: new Date(Date.UTC(2026, 9, 27, 10, corrections.length, 0)),
          correctedBy: { firstName: 'Мастер', lastName: 'Петров', email: 'm@x' },
          ...data,
        }
        corrections.push(row)
        return row
      }),
      findMany: jest.fn(async ({ where }: any) =>
        corrections.filter((row) => row.arrivalId === where.arrivalId && row.companyId === where.companyId),
      ),
    },
    technicianArrivalEvent: {
      create: jest.fn(async ({ data }: any) => {
        events.push(data)
        return data
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  }
  return { prisma, arrivals, corrections, events }
}

describe('on-site correction rights', () => {
  it('refuses a technician', async () => {
    const { prisma, corrections } = makePrisma({ companyType: CompanyType.PROVIDER })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await expect(
      service.create(technician, 'ticket-1', { reason: 'ошибся' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(corrections).toHaveLength(0)
  })

  it('refuses ADMIN of a client company', async () => {
    const { prisma, corrections } = makePrisma({ companyType: CompanyType.CLIENT })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await expect(
      service.create(clientAdmin, 'ticket-1', { reason: 'ошибся' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(corrections).toHaveLength(0)
  })

  it('appends a provider master correction without changing automatic times, ticket status, work log or comments', async () => {
    const { prisma, arrivals, corrections, events } = makePrisma({ companyType: CompanyType.PROVIDER })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await service.create(master, 'ticket-1', {
      reason: '  пришёл раньше  ',
      correctedArrivedAt: '2026-10-27T06:40:00.000Z',
      correctedDepartedAt: '',
    })

    expect(corrections).toHaveLength(1)
    expect(corrections[0].companyId).toBe('provider-1')
    expect(corrections[0].correctedByUserId).toBe(master.id)
    expect(corrections[0].reason).toBe('пришёл раньше')
    expect(corrections[0].correctedArrivedAt).toEqual(new Date('2026-10-27T06:40:00.000Z'))
    expect(corrections[0].correctedDepartedAt).toBeNull()
    expect(arrivals[0].arrivedAt).toEqual(ARRIVED)
    expect(arrivals[0].departedAt).toEqual(DEPARTED)
    expect(prisma.technicianArrival.update).not.toHaveBeenCalled()
    expect(events[0].kind).toBe('CORRECTION')
    expect(events[0].latitude).toBeUndefined()
    expect(prisma.ticket.update).not.toHaveBeenCalled()
    expect(prisma.workLog.update).not.toHaveBeenCalled()
    expect(prisma.workLog.create).not.toHaveBeenCalled()
    expect(prisma.ticketComment.create).not.toHaveBeenCalled()
  })

  it('allows both times to be empty', async () => {
    const { prisma, corrections, arrivals } = makePrisma({ companyType: CompanyType.PROVIDER })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await service.create(master, 'ticket-1', {
      reason: 'факта не было',
      correctedArrivedAt: '',
      correctedDepartedAt: null,
    })

    expect(corrections[0].correctedArrivedAt).toBeNull()
    expect(corrections[0].correctedDepartedAt).toBeNull()
    expect(arrivals[0].arrivedAt).toEqual(ARRIVED)
    expect(arrivals[0].departedAt).toEqual(DEPARTED)
  })

  it('refuses an empty reason', async () => {
    const { prisma, corrections } = makePrisma({ companyType: CompanyType.PROVIDER })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await expect(service.create(master, 'ticket-1', { reason: '   ' })).rejects.toBeInstanceOf(BadRequestException)
    expect(corrections).toHaveLength(0)
  })

  it('appends a second correction without erasing the first', async () => {
    const { prisma, corrections } = makePrisma({ companyType: CompanyType.PROVIDER })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await service.create(master, 'ticket-1', { reason: 'первая', correctedArrivedAt: '2026-10-27T06:40:00.000Z' })
    await service.create(master, 'ticket-1', { reason: 'вторая', correctedDepartedAt: '2026-10-27T08:10:00.000Z' })

    expect(corrections.map((row) => row.reason)).toEqual(['первая', 'вторая'])
    const history = await service.list(master, 'ticket-1')
    expect(history.items.map((row) => row.reason)).toEqual(['первая', 'вторая'])
    expect(history.items[0].correctedByName).toBe('Мастер Петров')
  })

  it('creates a provider arrival row when the automaton has not yet, and does not copy the client company', async () => {
    const { prisma, arrivals } = makePrisma({ companyType: CompanyType.PROVIDER, withArrival: false })
    const service = new WorkforceOnSiteCorrectionService(prisma as any)

    await service.create(master, 'ticket-1', { reason: 'отметил вручную' })

    expect(arrivals).toHaveLength(1)
    expect(arrivals[0].companyId).toBe('provider-1')
    expect(arrivals[0].arrivedAt).toBeNull()
    expect(arrivals[0].departedAt).toBeNull()
    expect(prisma.technicianArrival.update).not.toHaveBeenCalled()
  })
})

describe('on-site correction route roles', () => {
  it.each(['createOnSiteCorrection', 'listOnSiteCorrections'] as const)(
    'lets only provider staff roles through %s',
    (method) => {
      const roles = Reflect.getMetadata('roles', WorkforceController.prototype[method])
      const permissions = Reflect.getMetadata('permissions', WorkforceController.prototype[method])
      expect(roles).toEqual([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])
      expect(permissions).toBeUndefined()
      expect(roles).not.toContain(UserRole.TECHNICIAN)
      expect(roles).not.toContain(UserRole.CLIENT)
      expect(roles).not.toContain(UserRole.CLIENT_ADMIN)
      expect(roles).not.toContain(UserRole.NETWORK_DIRECTOR)
      expect(roles).not.toContain(UserRole.PLATFORM_ADMIN)
      expect(roles).not.toContain(UserRole.TERRITORIAL_MANAGER)
      expect(PERMISSIONS.USERS_MANAGE).toBe('USERS_MANAGE')
    },
  )
})
