import { Injectable } from '@nestjs/common'
import { ServiceContractRole, WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { TwogisRoutingService } from '../twogis/twogis-routing.service'
import {
  resolveReadableTicketAccess,
  type TicketAccessActor,
} from './ticket-access.utils'

export type TicketRouteResult = {
  available: boolean
  distanceMeters: number | null
  durationSeconds: number | null
}

type LatLon = { lat: number; lon: number }

type RouteCacheEntry = {
  expiresAt: number
  value: { distanceMeters: number; durationSeconds: number } | null
}

const UNAVAILABLE: TicketRouteResult = {
  available: false,
  distanceMeters: null,
  durationSeconds: null,
}

const ROUTE_CACHE_TTL_MS = 3 * 60 * 1000
const COORD_CACHE_DECIMALS = 4

function readFiniteCoord(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readLatLon(lat: unknown, lon: unknown): LatLon | null {
  const resolvedLat = readFiniteCoord(lat)
  const resolvedLon = readFiniteCoord(lon)
  if (resolvedLat === null || resolvedLon === null) return null
  return { lat: resolvedLat, lon: resolvedLon }
}

function roundCoord(value: number): number {
  const factor = 10 ** COORD_CACHE_DECIMALS
  return Math.round(value * factor) / factor
}

function routeCacheKey(from: LatLon, to: LatLon): string {
  return [
    roundCoord(from.lat),
    roundCoord(from.lon),
    roundCoord(to.lat),
    roundCoord(to.lon),
  ].join(':')
}

@Injectable()
export class TicketRouteService {
  private readonly routeCache = new Map<string, RouteCacheEntry>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly routing: TwogisRoutingService,
  ) {}

  async getForTicket(
    actor: TicketAccessActor,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ): Promise<TicketRouteResult> {
    await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
      allowedLinkedClientContractRoles: [
        ServiceContractRole.PRIMARY,
        ServiceContractRole.SECONDARY,
      ],
    })

    const [ticketRow, shift] = await Promise.all([
      this.prisma.ticket.findFirst({
        where: { id: ticketId },
        select: {
          location: {
            select: {
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.findOpenShiftLastGeo(actor),
    ])

    const destination = readLatLon(
      ticketRow?.location?.latitude,
      ticketRow?.location?.longitude,
    )
    const origin = readLatLon(shift?.lastLatitude, shift?.lastLongitude)
    if (!destination || !origin) return UNAVAILABLE

    const summary = await this.routeSummaryCached(origin, destination)
    if (!summary) return UNAVAILABLE

    return {
      available: true,
      distanceMeters: summary.distanceMeters,
      durationSeconds: summary.durationSeconds,
    }
  }

  private findOpenShiftLastGeo(actor: TicketAccessActor) {
    return this.prisma.workShift.findFirst({
      where: {
        companyId: actor.companyId,
        userId: actor.id,
        status: WorkShiftStatus.OPEN,
      },
      select: {
        lastLatitude: true,
        lastLongitude: true,
      },
    })
  }

  private async routeSummaryCached(
    from: LatLon,
    to: LatLon,
  ): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
    const key = routeCacheKey(from, to)
    const now = Date.now()
    const hit = this.routeCache.get(key)
    if (hit && hit.expiresAt > now) return hit.value

    const value = await this.routing.routeSummary(from, to)
    this.routeCache.set(key, { expiresAt: now + ROUTE_CACHE_TTL_MS, value })
    return value
  }
}
