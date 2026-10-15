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

type RouteSummary = { distanceMeters: number; durationSeconds: number }

type RouteCacheEntry = {
  expiresAt: number
  value: RouteSummary | null
}

const UNAVAILABLE: TicketRouteResult = {
  available: false,
  distanceMeters: null,
  durationSeconds: null,
}

/** Cache route summaries long enough that standing still does not re-hit 2GIS. */
export const ROUTE_CACHE_TTL_MS = 20 * 60 * 1000
/** ~111 m cells — GPS jitter must not create a new cache key. */
const ORIGIN_CACHE_DECIMALS = 3
/** Keep destinations finer so nearby buildings stay distinct. */
const DESTINATION_CACHE_DECIMALS = 4
export const TICKET_ROUTES_BATCH_MAX = 50
const ROUTING_CONCURRENCY = 4

function readFiniteCoord(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readLatLon(lat: unknown, lon: unknown): LatLon | null {
  const resolvedLat = readFiniteCoord(lat)
  const resolvedLon = readFiniteCoord(lon)
  if (resolvedLat === null || resolvedLon === null) return null
  return { lat: resolvedLat, lon: resolvedLon }
}

function roundCoord(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function pointKey(point: LatLon, decimals: number): string {
  return `${roundCoord(point.lat, decimals)}:${roundCoord(point.lon, decimals)}`
}

function routeCacheKey(from: LatLon, to: LatLon): string {
  return `${pointKey(from, ORIGIN_CACHE_DECIMALS)}:${pointKey(to, DESTINATION_CACHE_DECIMALS)}`
}

function toResult(summary: RouteSummary | null): TicketRouteResult {
  if (!summary) return UNAVAILABLE
  return {
    available: true,
    distanceMeters: summary.distanceMeters,
    durationSeconds: summary.durationSeconds,
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
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
    await this.assertReadable(actor, ticketId, linkedClientCompanyId, observerCompanyId)

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

    return toResult(await this.routeSummaryCached(origin, destination))
  }

  async getForTickets(
    actor: TicketAccessActor,
    ticketIds: string[],
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ): Promise<Record<string, TicketRouteResult>> {
    const ids = [...new Set(ticketIds)].slice(0, TICKET_ROUTES_BATCH_MAX)
    const results: Record<string, TicketRouteResult> = {}
    for (const id of ids) results[id] = UNAVAILABLE

    const shift = await this.findOpenShiftLastGeo(actor)
    const origin = readLatLon(shift?.lastLatitude, shift?.lastLongitude)
    if (!origin || ids.length === 0) return results

    const readable = await mapWithConcurrency(ids, ROUTING_CONCURRENCY, async (id) =>
      this.assertReadable(actor, id, linkedClientCompanyId, observerCompanyId)
        .then(() => id)
        .catch(() => null),
    )
    const readableIds = readable.filter((id): id is string => id !== null)
    if (readableIds.length === 0) return results

    const rows = await this.prisma.ticket.findMany({
      where: { id: { in: readableIds } },
      select: {
        id: true,
        location: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    })

    const ticketsByDestination = new Map<string, { destination: LatLon; ticketIds: string[] }>()
    for (const row of rows) {
      const destination = readLatLon(row.location?.latitude, row.location?.longitude)
      if (!destination) continue
      const key = pointKey(destination, DESTINATION_CACHE_DECIMALS)
      const entry = ticketsByDestination.get(key)
      if (entry) entry.ticketIds.push(row.id)
      else ticketsByDestination.set(key, { destination, ticketIds: [row.id] })
    }

    const destinations = [...ticketsByDestination.values()]
    const summaries = await mapWithConcurrency(destinations, ROUTING_CONCURRENCY, (entry) =>
      this.routeSummaryCached(origin, entry.destination),
    )
    destinations.forEach((entry, index) => {
      const result = toResult(summaries[index])
      for (const id of entry.ticketIds) results[id] = result
    })
    return results
  }

  private assertReadable(
    actor: TicketAccessActor,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    return resolveReadableTicketAccess({
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

  private async routeSummaryCached(from: LatLon, to: LatLon): Promise<RouteSummary | null> {
    const key = routeCacheKey(from, to)
    const now = Date.now()
    const hit = this.routeCache.get(key)
    if (hit && hit.expiresAt > now) return hit.value

    const value = await this.routing.routeSummary(from, to)
    this.routeCache.set(key, { expiresAt: now + ROUTE_CACHE_TTL_MS, value })
    return value
  }
}
