import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { UserRole, WorkShiftStatus } from '@prisma/client'

import { haversineMeters, TicketRouteService } from './ticket-route.service'
import * as ticketAccessUtils from './ticket-access.utils'

jest.mock('./ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

const mockResolveReadable =
  ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
    typeof ticketAccessUtils.resolveReadableTicketAccess
  >

const TICKET_ID = 'ticket-1'
const ACTOR = {
  id: 'user-1',
  role: UserRole.TECHNICIAN,
  companyId: 'company-1',
}

const LOCATION_POINT = { latitude: 55.751244, longitude: 37.618423 }
const SHIFT_POINT = { lastLatitude: 55.760002, lastLongitude: 37.618423 }
const OTHER_POINT = { latitude: 55.7, longitude: 37.5 }

function expectedMeters(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  return haversineMeters(
    { lat: fromLat, lon: fromLon },
    { lat: toLat, lon: toLon },
  )
}

function makeAccess() {
  return {
    ticket: { id: TICKET_ID, companyId: 'client-1', assignedTechnicianId: ACTOR.id },
    scopeCompanyId: 'client-1',
    visibilityMode: 'tenant' as const,
  }
}

function makeSetup() {
  const prisma = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue({
        location: LOCATION_POINT,
      }),
    },
    workShift: {
      findFirst: jest.fn().mockResolvedValue(SHIFT_POINT),
    },
  }
  const svc = new TicketRouteService(prisma as any, {} as any)
  return { svc, prisma }
}

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters({ lat: 55.75, lon: 37.62 }, { lat: 55.75, lon: 37.62 })).toBeLessThan(1)
  })

  it('measures roughly one hundred meters for a 0.001° latitude step', () => {
    const meters = haversineMeters(
      { lat: 55.75, lon: 37.62 },
      { lat: 55.751, lon: 37.62 },
    )
    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(130)
  })
})

describe('TicketRouteService.getForTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveReadable.mockResolvedValue(makeAccess() as any)
  })

  it('does not compute distance when ticket location coords are missing', async () => {
    const { svc, prisma } = makeSetup()
    prisma.ticket.findFirst.mockResolvedValue({
      location: { latitude: null, longitude: null },
    })

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: false,
      distanceMeters: null,
      durationSeconds: null,
    })
  })

  it('does not compute distance when the open shift has no last geo', async () => {
    const { svc, prisma } = makeSetup()
    prisma.workShift.findFirst.mockResolvedValue({
      lastLatitude: null,
      lastLongitude: null,
    })

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: false,
      distanceMeters: null,
      durationSeconds: null,
    })
  })

  it('returns straight-line meters and null duration when both points are present', async () => {
    const { svc, prisma } = makeSetup()
    const meters = expectedMeters(
      SHIFT_POINT.lastLatitude,
      SHIFT_POINT.lastLongitude,
      LOCATION_POINT.latitude,
      LOCATION_POINT.longitude,
    )

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: true,
      distanceMeters: meters,
      durationSeconds: null,
    })
    expect(prisma.workShift.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: ACTOR.companyId,
        userId: ACTOR.id,
        status: WorkShiftStatus.OPEN,
      },
      select: {
        lastLatitude: true,
        lastLongitude: true,
      },
    })
  })

  it('bubbles access denied from resolveReadableTicketAccess', async () => {
    const { svc, prisma } = makeSetup()
    mockResolveReadable.mockRejectedValue(new NotFoundException('Ticket not found'))

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled()
    expect(prisma.workShift.findFirst).not.toHaveBeenCalled()
  })

  it('bubbles ForbiddenException from ticket read access', async () => {
    const { svc } = makeSetup()
    mockResolveReadable.mockRejectedValue(
      new ForbiddenException('Linked client access is not available'),
    )

    await expect(
      svc.getForTicket(ACTOR, TICKET_ID, 'client-2'),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockResolveReadable).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: TICKET_ID,
        linkedClientCompanyId: 'client-2',
      }),
    )
  })
})

describe('TicketRouteService.getForTickets', () => {
  const UNAVAILABLE = { available: false, distanceMeters: null, durationSeconds: null }

  function availableFor(
    toLat: number,
    toLon: number,
  ): { available: true; distanceMeters: number; durationSeconds: null } {
    return {
      available: true,
      distanceMeters: expectedMeters(
        SHIFT_POINT.lastLatitude,
        SHIFT_POINT.lastLongitude,
        toLat,
        toLon,
      ),
      durationSeconds: null,
    }
  }

  function makeBatchSetup(rows: Array<{ id: string; location: { latitude: number | null; longitude: number | null } | null }>) {
    const setup = makeSetup()
    const prisma = setup.prisma as typeof setup.prisma & { ticket: { findMany: jest.Mock } }
    prisma.ticket.findMany = jest.fn().mockResolvedValue(rows)
    return { ...setup, prisma }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveReadable.mockResolvedValue(makeAccess() as any)
  })

  it('computes once per destination and fans the result out to its tickets', async () => {
    const { svc } = makeBatchSetup([
      { id: 't-1', location: LOCATION_POINT },
      { id: 't-2', location: LOCATION_POINT },
      { id: 't-3', location: OTHER_POINT },
    ])

    const result = await svc.getForTickets(ACTOR, ['t-1', 't-2', 't-3'], 'client-1')

    expect(result).toEqual({
      't-1': availableFor(LOCATION_POINT.latitude, LOCATION_POINT.longitude),
      't-2': availableFor(LOCATION_POINT.latitude, LOCATION_POINT.longitude),
      't-3': availableFor(OTHER_POINT.latitude, OTHER_POINT.longitude),
    })
    expect(mockResolveReadable).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 't-1', linkedClientCompanyId: 'client-1' }),
    )
  })

  it('marks unreadable tickets unavailable and does not load them', async () => {
    const { svc, prisma } = makeBatchSetup([{ id: 't-1', location: LOCATION_POINT }])
    mockResolveReadable.mockImplementation(async ({ ticketId }: any) => {
      if (ticketId === 't-foreign') throw new NotFoundException('Ticket not found')
      return makeAccess() as any
    })

    const result = await svc.getForTickets(ACTOR, ['t-1', 't-foreign'])

    expect(result).toEqual({
      't-1': availableFor(LOCATION_POINT.latitude, LOCATION_POINT.longitude),
      't-foreign': UNAVAILABLE,
    })
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['t-1'] } } }),
    )
  })

  it('returns all unavailable without access checks when the shift has no point', async () => {
    const { svc, prisma } = makeBatchSetup([])
    prisma.workShift.findFirst.mockResolvedValue(null)

    const result = await svc.getForTickets(ACTOR, ['t-1', 't-2'])

    expect(result).toEqual({ 't-1': UNAVAILABLE, 't-2': UNAVAILABLE })
    expect(mockResolveReadable).not.toHaveBeenCalled()
  })

  it('leaves tickets without location coords unavailable', async () => {
    const { svc } = makeBatchSetup([
      { id: 't-1', location: { latitude: null, longitude: null } },
      { id: 't-2', location: null },
    ])

    const result = await svc.getForTickets(ACTOR, ['t-1', 't-2'])

    expect(result).toEqual({ 't-1': UNAVAILABLE, 't-2': UNAVAILABLE })
  })
})
