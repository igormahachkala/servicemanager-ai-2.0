import * as api from './api'
import type { ScopeParams } from './equipmentCard'

export const SERVICE_HISTORY_LIMIT = 20
export const SERVICE_HISTORY_TICKET_LIMIT = 10

export type ServiceHistoryTarget = { locationId?: string; equipmentId?: string }
export type ServiceHistoryRun = api.InspectionRunListItem & { scheduleId?: string | null }
export type ServiceHistoryLinks = {
  plan: { name: string; path: string } | null
  tickets: Array<{ id: string; number: number | null; status: api.TicketStatus; path: string }>
  incomplete: boolean
}

/** No tenant override: Inspection belongs to the executing company, not the site owner. */
export function serviceHistoryFilter(target: ServiceHistoryTarget) {
  const locationId = target.locationId?.trim() || undefined
  const equipmentId = target.equipmentId?.trim() || undefined
  if (!locationId && !equipmentId) throw new Error('History requires a location or equipment')
  return { locationId, equipmentId, limit: SERVICE_HISTORY_LIMIT }
}

export function getServiceHistory(target: ServiceHistoryTarget): Promise<ServiceHistoryRun[]> {
  // The canonical client serializes every defined filter using Object.entries.
  return api.getInspectionRuns(serviceHistoryFilter(target))
}

/** Defensive UI boundary, not authorization: the server remains the only scope authority. */
export function serviceHistoryRows(rows: ServiceHistoryRun[], target: ServiceHistoryTarget) {
  const filter = serviceHistoryFilter(target)
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (filter.locationId && row.location.id !== filter.locationId) return false
    if (filter.equipmentId && row.equipment?.id !== filter.equipmentId) return false
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  }).slice(0, SERVICE_HISTORY_LIMIT)
}

function canonicalScope(scope: ScopeParams): api.TicketScopeParams {
  return {
    companyId: scope.companyId?.trim() || undefined,
    linkedClientCompanyId: scope.linkedClientCompanyId?.trim() || undefined,
  }
}

export function serviceHistoryPath(path: string, scope: ScopeParams) {
  // An explicit object avoids reading a different saved/browser scope.
  return api.appendScopeToPath(path, canonicalScope(scope))
}

function isUnavailable(error: unknown) {
  return error instanceof api.ApiRequestError && [403, 404].includes(error.status)
}

/**
 * Read through each canonical endpoint, never through equipment-history or a new aggregate.
 * Inspection's embedded ticket objects are deliberately discarded. Only a successful direct
 * ticket read can supply a number, status or link. Denials expose no IDs or denial counts.
 * Call this only for the single expanded row; the number of ticket reads is bounded.
 */
export async function getServiceHistoryLinks(
  row: ServiceHistoryRun,
  target: ServiceHistoryTarget,
  scope: ScopeParams,
  signal?: AbortSignal,
): Promise<ServiceHistoryLinks> {
  signal?.throwIfAborted()
  const run = await api.getInspectionRun(row.id)
  signal?.throwIfAborted()
  const filter = serviceHistoryFilter(target)
  if (
    run.id !== row.id ||
    (filter.locationId && run.locationId !== filter.locationId) ||
    (filter.equipmentId && run.equipmentId !== filter.equipmentId)
  ) throw new Error('История изменилась. Обновите список обходов.')

  const result: ServiceHistoryLinks = { plan: null, tickets: [], incomplete: false }
  if (row.scheduleId) {
    try {
      const plan = await api.getInspectionSchedule(row.scheduleId)
      signal?.throwIfAborted()
      if (plan.id === row.scheduleId) {
        const path = `/inspection/schedules?locationId=${encodeURIComponent(plan.location.id)}`
        result.plan = { name: plan.name, path: serviceHistoryPath(path, scope) }
      }
    } catch (error) {
      if (!isUnavailable(error)) result.incomplete = true
    }
  }

  const ticketIds = [...new Set(run.items.map((item) => item.ticketId).filter((id): id is string => !!id))]
  // Sequential reads prevent a burst of requests; no hidden total is returned to the UI.
  for (const id of ticketIds.slice(0, SERVICE_HISTORY_TICKET_LIMIT)) {
    signal?.throwIfAborted()
    try {
      const ticket = await api.getTicket(id, canonicalScope(scope))
      signal?.throwIfAborted()
      if (ticket.id !== id) continue
      result.tickets.push({
        id: ticket.id,
        number: ticket.ticketNumber ?? null,
        status: ticket.status,
        path: serviceHistoryPath(`/tickets/${encodeURIComponent(ticket.id)}`, scope),
      })
    } catch (error) {
      if (!isUnavailable(error)) result.incomplete = true
    }
  }
  signal?.throwIfAborted()
  return result
}
