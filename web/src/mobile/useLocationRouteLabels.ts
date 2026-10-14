import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { getTicketRoutes, type TicketRoutesResponse } from '../lib/ticketRouteApi'
import { hasOpenWorkShift, isShiftGateSubjectRole, type ShiftGateRole } from './mobileShiftGate'
import { formatTicketRouteLabel } from './MobileTicketRouteDuration'
import { SHIFT_GEO_INTERVAL_MS } from './shiftGeolocation'

type TicketWithLocation = Pick<api.TicketCard, 'id' | 'location'>

/** One ticket per location: the route depends only on the location, access is checked per ticket. */
export function pickLocationRouteTickets(tickets: TicketWithLocation[]): Map<string, string> {
  const byLocation = new Map<string, string>()
  for (const ticket of tickets) {
    const locationId = ticket.location?.id
    if (locationId && !byLocation.has(locationId)) byLocation.set(locationId, ticket.id)
  }
  return byLocation
}

export function locationRouteLabels(
  ticketByLocation: ReadonlyMap<string, string>,
  routes: TicketRoutesResponse | undefined,
): Map<string, string> {
  const labels = new Map<string, string>()
  if (!routes) return labels
  for (const [locationId, ticketId] of ticketByLocation) {
    const route = routes[ticketId]
    if (!route?.available || route.distanceMeters == null || route.durationSeconds == null) continue
    labels.set(locationId, formatTicketRouteLabel(route.distanceMeters, route.durationSeconds))
  }
  return labels
}

export function useLocationRouteLabels(
  tickets: TicketWithLocation[],
  role: ShiftGateRole | null | undefined,
  scope: api.TicketScopeParams,
): ReadonlyMap<string, string> {
  const subject = isShiftGateSubjectRole(role)
  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    enabled: subject,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  })
  const openShiftId = subject && hasOpenWorkShift(stateQ.data) ? stateQ.data?.shift?.id ?? null : null

  const ticketByLocation = useMemo(() => pickLocationRouteTickets(tickets), [tickets])
  const ticketIds = useMemo(() => [...ticketByLocation.values()].sort(), [ticketByLocation])

  const routesQ = useQuery({
    queryKey: ['ticket-routes', openShiftId, scope.companyId ?? null, scope.linkedClientCompanyId ?? null, ticketIds.join(',')],
    queryFn: () => getTicketRoutes(ticketIds, scope),
    enabled: !!openShiftId && ticketIds.length > 0,
    staleTime: SHIFT_GEO_INTERVAL_MS,
    retry: false,
  })

  return useMemo(
    () => (openShiftId ? locationRouteLabels(ticketByLocation, routesQ.data) : new Map<string, string>()),
    [openShiftId, ticketByLocation, routesQ.data],
  )
}
