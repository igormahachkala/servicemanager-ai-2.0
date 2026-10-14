import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { UserRole, WorkShiftStatus } from '@prisma/client'

import { TicketRouteService } from './ticket-route.service'
import * as ticketAccessUtils from './ticket-access.utils'

jest.mock('./ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

jest.mock('../twogis/twogis-routing.service', () => ({
  TwogisRoutingService: class TwogisRoutingService {},
}), { virtual: true })

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
const ROUTE_SUMMARY = { distanceMeters: 4200, durationSeconds: 1080 }

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
  const routing = {
    routeSummary: jest.fn().mockResolvedValue(ROUTE_SUMMARY),
  }
  const svc = new TicketRouteService(prisma as any, {} as any, routing as any)
  return { svc, prisma, routing }
}

describe('TicketRouteService.getForTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveReadable.mockResolvedValue(makeAccess() as any)
  })

  it('does not call routeSummary when ticket location coords are missing', async () => {
    const { svc, prisma, routing } = makeSetup()
    prisma.ticket.findFirst.mockResolvedValue({
      location: { latitude: null, longitude: null },
    })

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: false,
      distanceMeters: null,
      durationSeconds: null,
    })
    expect(routing.routeSummary).not.toHaveBeenCalled()
  })

  it('does not call routeSummary when the open shift has no last geo', async () => {
    const { svc, prisma, routing } = makeSetup()
    prisma.workShift.findFirst.mockResolvedValue({
      lastLatitude: null,
      lastLongitude: null,
    })

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: false,
      distanceMeters: null,
      durationSeconds: null,
    })
    expect(routing.routeSummary).not.toHaveBeenCalled()
  })

  it('returns duration when both points are present', async () => {
    const { svc, prisma, routing } = makeSetup()

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: true,
      distanceMeters: 4200,
      durationSeconds: 1080,
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
    expect(routing.routeSummary).toHaveBeenCalledWith(
      { lat: SHIFT_POINT.lastLatitude, lon: SHIFT_POINT.lastLongitude },
      { lat: LOCATION_POINT.latitude, lon: LOCATION_POINT.longitude },
    )
  })

  it('bubbles access denied from resolveReadableTicketAccess', async () => {
    const { svc, prisma, routing } = makeSetup()
    mockResolveReadable.mockRejectedValue(new NotFoundException('Ticket not found'))

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled()
    expect(prisma.workShift.findFirst).not.toHaveBeenCalled()
    expect(routing.routeSummary).not.toHaveBeenCalled()
  })

  it('bubbles ForbiddenException from ticket read access', async () => {
    const { svc, routing } = makeSetup()
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
    expect(routing.routeSummary).not.toHaveBeenCalled()
  })

  it('returns unavailable when routeSummary is null', async () => {
    const { svc, routing } = makeSetup()
    routing.routeSummary.mockResolvedValue(null)

    await expect(svc.getForTicket(ACTOR, TICKET_ID)).resolves.toEqual({
      available: false,
      distanceMeters: null,
      durationSeconds: null,
    })
    expect(routing.routeSummary).toHaveBeenCalledTimes(1)
  })
})
