import { TicketStatus, WorkShiftStatus } from '@prisma/client'

import { haversineMeters } from '../tickets/ticket-route.service'
import { WorkforceGeoService } from './workforce-geo.service'
import { WorkforceOnSiteService } from './workforce-on-site.service'

const PROVIDER = 'provider-1'
const USER = 'tech-1'
const SITE = { lat: 55.751244, lon: 37.618423 }

function boundary() {
  let lo = 0
  let hi = 0.02
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    const distance = haversineMeters(SITE, { lat: SITE.lat + mid, lon: SITE.lon })
    if (distance <= 100) lo = mid
    else hi = mid
  }
  const inside = { latitude: SITE.lat + lo, longitude: SITE.lon }
  const outside = { latitude: SITE.lat + hi, longitude: SITE.lon }
  return { inside, outside }
}

const EDGE = boundary()

type TicketFixture = {
  id: string
  companyId: string
  status: TicketStatus
  assignedTechnicianId: string
  location: { latitude: number | null; longitude: number | null }
}

function ticket(over: Partial<TicketFixture> = {}): TicketFixture {
  return {
    id: 'ticket-1',
    companyId: 'client-9',
    status: TicketStatus.ASSIGNED,
    assignedTechnicianId: USER,
    location: { latitude: SITE.lat, longitude: SITE.lon },
    ...over,
  }
}

function makeHarness(tickets: TicketFixture[]) {
  const arrivals: any[] = []
  const events: any[] = []
  let seq = 0
  let settings: { accuracyMeters: number; freshnessMinutes: number; radiusMeters: number } | null = null
  const prisma = {
    ticket: {
      findMany: jest.fn(async ({ where }: any) => {
        const statuses: string[] = where.status.in
        return tickets
          .filter((row) => row.assignedTechnicianId === where.assignedTechnicianId)
          .filter((row) => statuses.includes(row.status))
          .map((row) => ({ id: row.id, location: row.location }))
      }),
      update: jest.fn(),
    },
    workLog: {
      update: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    technicianArrival: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.ticketId_userId
        return arrivals.find((row) => row.ticketId === key.ticketId && row.userId === key.userId) ?? null
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `arr-${++seq}`,
          arrivedAt: null,
          departedAt: null,
          lastDistanceMeters: null,
          lastCheckedAt: null,
          candidateSide: null,
          candidateStreak: 0,
          ...data,
        }
        arrivals.push(row)
        return row
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = arrivals.find((item) => item.id === where.id)
        if (!row) throw new Error('missing arrival')
        Object.assign(row, data)
        return row
      }),
      delete: jest.fn(),
    },
    technicianArrivalEvent: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `ev-${++seq}`, createdAt: new Date(), ...data }
        events.push(row)
        return row
      }),
    },
    platformArrivalSettings: {
      findUnique: jest.fn(async () => settings),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  }
  const service = new WorkforceOnSiteService(prisma as any)
  return {
    prisma,
    arrivals,
    events,
    service,
    setSettings(next: typeof settings) {
      settings = next
    },
  }
}

function point(
  coords: { latitude: number; longitude: number },
  when: string,
  accuracy: number | null = 10,
  receivedAt?: Date,
) {
  const capturedAt = new Date(when)
  return {
    companyId: PROVIDER,
    userId: USER,
    latitude: coords.latitude,
    longitude: coords.longitude,
    capturedAt,
    accuracy,
    receivedAt: receivedAt ?? capturedAt,
  }
}

describe('WorkforceOnSiteService automaton', () => {
  it('keeps the 100 m boundary inside and stores the provider company', async () => {
    expect(haversineMeters(SITE, { lat: EDGE.inside.latitude, lon: EDGE.inside.longitude })).toBeLessThanOrEqual(100)
    const { service, arrivals, events, prisma } = makeHarness([
      ticket(),
      ticket({ id: 'ticket-done', status: TicketStatus.DONE }),
    ])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z'))

    expect(arrivals).toHaveLength(1)
    expect(arrivals[0].companyId).toBe(PROVIDER)
    expect(arrivals[0].companyId).not.toBe('client-9')
    expect(arrivals[0].ticketId).toBe('ticket-1')
    expect(arrivals[0].candidateSide).toBe('INSIDE')
    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(arrivals[0].departedAt).toBeNull()
    expect(events.map((event) => event.kind)).toEqual(['ARRIVED'])
    expect(events[0].latitude).toBeUndefined()
    expect(events[0].longitude).toBeUndefined()
    expect(prisma.ticket.update).not.toHaveBeenCalled()
    expect(prisma.workLog.update).not.toHaveBeenCalled()
    expect(prisma.workLog.create).not.toHaveBeenCalled()
  })

  it('treats a point farther than 100 m as outside and does not arrive', async () => {
    expect(haversineMeters(SITE, { lat: EDGE.outside.latitude, lon: EDGE.outside.longitude })).toBeGreaterThan(100)
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:00:00.000Z'))

    expect(arrivals).toHaveLength(1)
    expect(arrivals[0].candidateSide).toBe('OUTSIDE')
    expect(arrivals[0].candidateStreak).toBe(1)
    expect(arrivals[0].arrivedAt).toBeNull()
    expect(arrivals[0].departedAt).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('does not switch on a single confirmation', async () => {
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z'))

    expect(arrivals[0].candidateSide).toBe('INSIDE')
    expect(arrivals[0].candidateStreak).toBe(1)
    expect(arrivals[0].arrivedAt).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('confirms entry and exit on the second fresh point', async () => {
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z'))
    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:02:00.000Z'))
    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:03:00.000Z'))

    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(arrivals[0].departedAt).toEqual(new Date('2026-10-27T07:03:00.000Z'))
    expect(events.map((event) => event.kind)).toEqual(['ARRIVED', 'DEPARTED'])
  })

  it('arrives again after departure and keeps the departure event', async () => {
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z'))
    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:02:00.000Z'))
    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:03:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:04:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:05:00.000Z'))

    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:05:00.000Z'))
    expect(arrivals[0].departedAt).toEqual(new Date('2026-10-27T07:03:00.000Z'))
    expect(events.map((event) => event.kind)).toEqual(['ARRIVED', 'DEPARTED', 'ARRIVED'])
  })

  it('does not arrive on accuracy worse than 100 m and does not reset the candidate', async () => {
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z', null))
    expect(arrivals).toHaveLength(0)

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z', 10))
    await service.onGeoPoint(point(EDGE.outside, '2026-10-27T07:02:00.000Z', 100.1))

    expect(arrivals).toHaveLength(1)
    expect(arrivals[0].candidateSide).toBe('INSIDE')
    expect(arrivals[0].candidateStreak).toBe(1)
    expect(arrivals[0].arrivedAt).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('accepts accuracy of exactly 100 m', async () => {
    const { service, arrivals } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z', 100))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z', 100))

    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
  })

  it('does not mark departure when the point is older than 10 minutes', async () => {
    const { service, arrivals, events } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z'))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z'))
    const receivedAt = new Date('2026-10-27T07:20:00.000Z')
    const capturedAt = new Date(receivedAt.getTime() - 11 * 60 * 1000)
    await service.onGeoPoint({
      ...point(EDGE.outside, capturedAt.toISOString(), 10, receivedAt),
    })

    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(arrivals[0].departedAt).toBeNull()
    expect(arrivals[0].candidateSide).toBe('INSIDE')
    expect(arrivals[0].candidateStreak).toBe(2)
    expect(events.map((event) => event.kind)).toEqual(['ARRIVED'])
  })

  it('counts two tickets from one phone point separately', async () => {
    const far = { latitude: SITE.lat + 0.02, longitude: SITE.lon }
    const { service, arrivals } = makeHarness([
      ticket({ id: 'near', status: TicketStatus.IN_PROGRESS }),
      ticket({
        id: 'far',
        location: far,
      }),
      ticket({ id: 'done', status: TicketStatus.DONE }),
    ])

    await service.onGeoPoint(point({ latitude: SITE.lat, longitude: SITE.lon }, '2026-10-27T07:00:00.000Z'))
    await service.onGeoPoint(point({ latitude: SITE.lat, longitude: SITE.lon }, '2026-10-27T07:01:00.000Z'))

    const near = arrivals.find((row) => row.ticketId === 'near')
    const away = arrivals.find((row) => row.ticketId === 'far')
    expect(near.arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(away.arrivedAt).toBeNull()
    expect(away.candidateSide).toBe('OUTSIDE')
    expect(arrivals.find((row) => row.ticketId === 'done')).toBeUndefined()
  })

  it('does not write a point or erase a fact when the shift is closed', async () => {
    const prisma = {
      workShift: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      geoAccuracyBucket: { upsert: jest.fn() },
      geoAccuracySample: { create: jest.fn() },
      $transaction: jest.fn(),
      technicianArrival: {
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    }
    const onSite = { onGeoPoint: jest.fn() }
    const geo = new WorkforceGeoService(prisma as any, onSite as any)

    await expect(
      geo.updateMyPoint(
        { id: USER, companyId: PROVIDER },
        { latitude: SITE.lat, longitude: SITE.lon },
      ),
    ).rejects.toMatchObject({ message: 'Сначала откройте рабочую смену' })

    expect(prisma.workShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: WorkShiftStatus.OPEN }),
      }),
    )
    expect(prisma.workShift.update).not.toHaveBeenCalled()
    expect(onSite.onGeoPoint).not.toHaveBeenCalled()
    expect(prisma.technicianArrival.update).not.toHaveBeenCalled()
    expect(prisma.technicianArrival.delete).not.toHaveBeenCalled()
    expect(prisma.technicianArrival.deleteMany).not.toHaveBeenCalled()
    expect(prisma.geoAccuracySample.create).not.toHaveBeenCalled()
    expect(prisma.geoAccuracyBucket.upsert).not.toHaveBeenCalled()
  })

  it('stays on 100 m, 10 minutes and 100 m when PlatformArrivalSettings is absent', async () => {
    const { service, arrivals, prisma } = makeHarness([ticket()])

    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z', 100))
    await service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z', 100))

    expect(prisma.platformArrivalSettings.findUnique).toHaveBeenCalledWith({
      where: { id: 'platform' },
      select: { accuracyMeters: true, freshnessMinutes: true, radiusMeters: true },
    })
    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))

    const receivedAt = new Date('2026-10-27T07:20:00.000Z')
    const capturedAt = new Date(receivedAt.getTime() - 11 * 60 * 1000)
    await service.onGeoPoint(point(EDGE.outside, capturedAt.toISOString(), 10, receivedAt))

    expect(arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(arrivals[0].departedAt).toBeNull()
  })

  it('reads radius, freshness and accuracy from the settings row and does not rewrite arrivedAt', async () => {
    const strict = makeHarness([ticket()])
    strict.setSettings({ accuracyMeters: 40, freshnessMinutes: 10, radiusMeters: 100 })
    const atSite = { latitude: SITE.lat, longitude: SITE.lon }

    await strict.service.onGeoPoint(point(atSite, '2026-10-27T07:00:00.000Z', 40))
    await strict.service.onGeoPoint(point(atSite, '2026-10-27T07:01:00.000Z', 40))
    expect(strict.arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))

    await strict.service.onGeoPoint(point(atSite, '2026-10-27T07:02:00.000Z', 40.1))
    expect(strict.arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(strict.arrivals[0].departedAt).toBeNull()

    const narrow = makeHarness([ticket()])
    narrow.setSettings({ accuracyMeters: 100, freshnessMinutes: 10, radiusMeters: 50 })
    await narrow.service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:00:00.000Z', 10))
    await narrow.service.onGeoPoint(point(EDGE.inside, '2026-10-27T07:01:00.000Z', 10))
    expect(narrow.arrivals[0].candidateSide).toBe('OUTSIDE')
    expect(narrow.arrivals[0].arrivedAt).toBeNull()

    const longer = makeHarness([ticket()])
    longer.setSettings({ accuracyMeters: 100, freshnessMinutes: 30, radiusMeters: 100 })
    await longer.service.onGeoPoint(point(atSite, '2026-10-27T07:00:00.000Z', 10))
    await longer.service.onGeoPoint(point(atSite, '2026-10-27T07:01:00.000Z', 10))
    const staleReceived = new Date('2026-10-27T08:00:00.000Z')
    const staleCaptured = new Date(staleReceived.getTime() - 11 * 60 * 1000)
    const staleReceived2 = new Date(staleReceived.getTime() + 60_000)
    const staleCaptured2 = new Date(staleReceived2.getTime() - 11 * 60 * 1000)
    await longer.service.onGeoPoint(point(EDGE.outside, staleCaptured.toISOString(), 10, staleReceived))
    await longer.service.onGeoPoint(point(EDGE.outside, staleCaptured2.toISOString(), 10, staleReceived2))
    expect(longer.arrivals[0].arrivedAt).toEqual(new Date('2026-10-27T07:01:00.000Z'))
    expect(longer.arrivals[0].departedAt).toEqual(staleCaptured2)
  })
})
