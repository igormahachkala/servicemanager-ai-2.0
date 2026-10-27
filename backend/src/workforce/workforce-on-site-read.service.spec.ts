import { ForbiddenException } from '@nestjs/common'
import { CompanyType, UserRole, WorkShiftStatus } from '@prisma/client'

import { haversineMeters } from '../tickets/ticket-route.service'
import { WorkforceOnSiteReadService } from './workforce-on-site-read.service'

const SITE = { lat: 55.751244, lon: 37.618423 }
const NOW = new Date('2026-10-27T07:12:00.000Z')

function north(meters: number) {
  const fraction = meters / haversineMeters(SITE, { lat: SITE.lat + 0.01, lon: SITE.lon })
  return { latitude: SITE.lat + 0.01 * fraction, longitude: SITE.lon }
}

const NEAR = north(80)
const MID = north(400)
const FAR = north(2400)

const master = { id: 'master-1', companyId: 'provider-1', role: UserRole.MASTER }

function shift(status: WorkShiftStatus, lastGeoAt: Date | null) {
  return {
    status,
    lastLatitude: SITE.lat,
    lastLongitude: SITE.lon,
    lastGeoAt,
    openedAt: new Date('2026-10-27T01:00:00.000Z'),
  }
}

function location(coords: { latitude: number; longitude: number } | null, name: string) {
  return {
    name,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  }
}

function buildWorld() {
  const users = [
    {
      id: 'tech-1',
      companyId: 'provider-1',
      firstName: 'Иван',
      lastName: 'Петров',
      email: 'ivan@x',
      workShifts: [shift(WorkShiftStatus.OPEN, NOW)],
      assignedTickets: [
        {
          id: 'ticket-near',
          ticketNumber: 11,
          companyId: 'client-9',
          status: 'IN_PROGRESS',
          location: location(NEAR, 'Близкая'),
        },
        {
          id: 'ticket-far',
          ticketNumber: 12,
          companyId: 'client-8',
          status: 'ASSIGNED',
          location: location(FAR, 'Дальняя'),
        },
        {
          id: 'ticket-empty',
          ticketNumber: 13,
          companyId: 'client-7',
          status: 'ASSIGNED',
          location: location(null, 'Без координат'),
        },
      ],
    },
    {
      id: 'tech-2',
      companyId: 'provider-1',
      firstName: 'Анна',
      lastName: 'Сидорова',
      email: 'anna@x',
      workShifts: [shift(WorkShiftStatus.CLOSED, new Date('2026-10-27T05:00:00.000Z'))],
      assignedTickets: [
        {
          id: 'ticket-mid',
          ticketNumber: 21,
          companyId: 'client-9',
          status: 'ASSIGNED',
          location: location(MID, 'Средняя'),
        },
      ],
    },
    {
      id: 'tech-foreign',
      companyId: 'provider-2',
      firstName: 'Чужой',
      lastName: 'Техник',
      email: 'foreign@x',
      workShifts: [shift(WorkShiftStatus.OPEN, NOW)],
      assignedTickets: [
        {
          id: 'ticket-foreign',
          ticketNumber: 99,
          companyId: 'client-9',
          status: 'ASSIGNED',
          location: location(NEAR, 'Чужая'),
        },
      ],
    },
  ]
  const arrivals = [
    {
      userId: 'tech-1',
      ticketId: 'ticket-near',
      companyId: 'provider-1',
      arrivedAt: new Date('2026-10-27T07:12:00.000Z'),
      departedAt: null,
      corrections: [],
      events: [{ createdAt: new Date('2026-10-27T07:12:30.000Z') }],
    },
  ]
  return { users, arrivals }
}

function makeService(world = buildWorld(), company: { type: CompanyType; timezone: string | null } = {
  type: CompanyType.PROVIDER,
  timezone: 'Asia/Krasnoyarsk',
}) {
  const prisma = {
    company: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'provider-1' ? company : { type: CompanyType.CLIENT, timezone: 'UTC' })),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) =>
        world.users.filter((user) => user.companyId === where.companyId),
      ),
    },
    technicianArrival: {
      findMany: jest.fn(async ({ where }: any) => {
        expect(where.companyId).toBe('provider-1')
        return world.arrivals
      }),
      findUnique: jest.fn(async () => null),
    },
    ticket: { findFirst: jest.fn() },
  }
  return { service: new WorkforceOnSiteReadService(prisma as any), prisma, world }
}

describe('WorkforceOnSiteReadService', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('refuses a technician and a client-company admin', async () => {
    const { service } = makeService()
    await expect(
      service.list({ id: 'tech', companyId: 'provider-1', role: UserRole.TECHNICIAN }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    const client = makeService(buildWorld(), { type: CompanyType.CLIENT, timezone: 'UTC' })
    await expect(
      client.service.list({ id: 'admin', companyId: 'provider-1', role: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('returns only the actor provider company and hides phone coordinates', async () => {
    const { service } = makeService()
    const result = await service.list(master)
    const ids = result.items.map((card) => card.userId)
    expect(ids).toEqual(expect.arrayContaining(['tech-1', 'tech-2']))
    expect(ids).not.toContain('tech-foreign')
    const encoded = JSON.stringify(result)
    expect(encoded).not.toContain('latitude')
    expect(encoded).not.toContain('longitude')
    expect(encoded).not.toContain(String(SITE.lat))
    const near = result.items
      .find((card) => card.userId === 'tech-1')
      ?.lines.find((line) => line.ticketId === 'ticket-near')
    expect(near?.linkedClientCompanyId).toBe('client-9')
    expect(near?.ticketHref).toBe('/tickets/ticket-near?linkedClientCompanyId=client-9')
    expect(near?.label).toBe('Прибыл в 14:12')
  })

  it('filters by state on the server and sorts remaining lines by distance', async () => {
    const { service } = makeService()
    const byDistance = await service.list(master, { sort: 'distance' })
    expect(byDistance.items.map((card) => card.userId)).toEqual(['tech-1', 'tech-2'])
    const ivan = byDistance.items[0]
    expect(ivan.lines.map((line) => line.ticketId)).toEqual(['ticket-near', 'ticket-far', 'ticket-empty'])
    expect(ivan.lines[0].distanceMeters).toBeLessThan(ivan.lines[1].distanceMeters as number)

    const arrived = await service.list(master, { state: 'arrived', sort: 'distance' })
    expect(arrived.items).toHaveLength(1)
    expect(arrived.items[0].userId).toBe('tech-1')
    expect(arrived.items[0].lines.map((line) => line.state)).toEqual(['arrived'])
    expect(arrived.emptyReason).toBeNull()

    const nobody = await service.list(master, { technician: 'нет такого' })
    expect(nobody.items).toHaveLength(0)
    expect(nobody.emptyReason).toBe('filtered_out')
  })

  it('sorts cards by the five outcome order by default', async () => {
    const { service } = makeService()
    const result = await service.list(master)
    expect(result.sort).toBe('state')
    expect(result.items[0].userId).toBe('tech-1')
    expect(result.items[0].lines[0].state).toBe('no_coordinates')
    expect(result.items[0].lines.map((line) => line.stateOrder)).toEqual([1, 2, 4])
  })

  it('says there are no assignments when the provider has none', async () => {
    const { service } = makeService({ users: [], arrivals: [] })
    const result = await service.list(master)
    expect(result.items).toEqual([])
    expect(result.emptyReason).toBe('no_assignments')
  })
})
