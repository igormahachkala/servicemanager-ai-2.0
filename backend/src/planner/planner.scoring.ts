import type {
  PlannerContext,
  PlannerFrequency,
  PlannerPoolItem,
  ScoreReason,
  ScoredLocation,
  ScoredWork,
} from './planner.types'

/** All planner weight constants in one place. */
export const PLANNER_WEIGHTS = {
  URGENT: 100,
  DUE_UNDER_2H: 50,
  DUE_UNDER_6H: 25,
  DUE_TODAY: 15,
  DUE_TOMORROW: 5,
  INSPECTION_OVERDUE_BASE: 40,
  INSPECTION_OVERDUE_PER_DAY: 5,
  INSPECTION_IN_WINDOW: 10,
  ALREADY_HERE: 40,
  DISPATCHER_ASSIGNED: 30,
  ROAD_PER_KM: -2,
} as const

const MS_HOUR = 60 * 60 * 1000
const MS_DAY = 24 * MS_HOUR

const FREQUENCY_INTERVAL_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUAL: 180,
  ANNUAL: 365,
}

export const REASON_LABELS = {
  URGENT: 'Срочная',
  DUE_UNDER_2H: 'Срок < 2 ч',
  DUE_UNDER_6H: 'Срок < 6 ч',
  DUE_TODAY: 'Срок сегодня',
  DUE_TOMORROW: 'Срок завтра',
  DISPATCHER_ASSIGNED: 'Назначил диспетчер',
  ALREADY_HERE: 'Вы уже здесь',
  INSPECTION_IN_WINDOW: 'Обход в окне',
  inspectionOverdue: (days: number) => `Обход просрочен на ${days} дн.`,
} as const

function resolveIntervalDays(item: PlannerPoolItem): number | null {
  if (item.intervalDays != null && item.intervalDays > 0) return item.intervalDays
  const freq = item.frequency ?? null
  if (!freq || freq === 'ONCE' || freq === 'CUSTOM') return null
  return FREQUENCY_INTERVAL_DAYS[freq] ?? null
}

/**
 * Start of the inspection maturity window (inclusive), or null when the item
 * is not an inspection / has no dueAt.
 *
 * - leadTimeDays > 0 → window opens leadTimeDays before nextDueAt
 * - else last fifth of the interval (nextDueAt − interval/5)
 * - ONCE / no interval → window start = nextDueAt (in pool from that date)
 */
export function inspectionWindowStart(item: PlannerPoolItem): Date | null {
  if (item.kind !== 'INSPECTION' || !item.dueAt) return null

  const lead = item.leadTimeDays ?? 0
  if (lead > 0) {
    return new Date(item.dueAt.getTime() - lead * MS_DAY)
  }

  if ((item.frequency as PlannerFrequency | null) === 'ONCE') {
    return new Date(item.dueAt.getTime())
  }

  const interval = resolveIntervalDays(item)
  if (interval == null || interval <= 0) {
    return new Date(item.dueAt.getTime())
  }

  return new Date(item.dueAt.getTime() - (interval / 5) * MS_DAY)
}

/** True when an inspection is at or past its maturity window start. Tickets always pass. */
export function isInspectionMatured(item: PlannerPoolItem, now: Date): boolean {
  if (item.kind !== 'INSPECTION') return true
  if (!item.dueAt) return false
  const start = inspectionWindowStart(item)
  if (!start) return false
  return now.getTime() >= start.getTime()
}

/** Drop inspections that are still before their maturity window. Tickets pass through. */
export function filterMaturedCandidates(
  candidates: PlannerPoolItem[],
  now: Date,
): PlannerPoolItem[] {
  return candidates.filter((c) => isInspectionMatured(c, now))
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function calendarDayDiff(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.round((b - a) / MS_DAY)
}

/** Haversine distance in kilometres. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function pushReason(reasons: ScoreReason[], label: string, weight: number) {
  if (weight === 0) return
  reasons.push({ label, weight })
}

function scoreOne(item: PlannerPoolItem, ctx: PlannerContext): Omit<ScoredWork, 'suggestedFirst'> {
  const reasons: ScoreReason[] = []
  let total = 0

  if (item.urgent) {
    total += PLANNER_WEIGHTS.URGENT
    pushReason(reasons, REASON_LABELS.URGENT, PLANNER_WEIGHTS.URGENT)
  }

  if (item.dueAt) {
    const msUntil = item.dueAt.getTime() - ctx.now.getTime()

    if (item.kind === 'INSPECTION' && msUntil < 0) {
      const daysOverdue = Math.max(0, Math.floor(-msUntil / MS_DAY))
      const weight =
        PLANNER_WEIGHTS.INSPECTION_OVERDUE_BASE +
        PLANNER_WEIGHTS.INSPECTION_OVERDUE_PER_DAY * daysOverdue
      total += weight
      pushReason(reasons, REASON_LABELS.inspectionOverdue(daysOverdue), weight)
    } else if (item.kind === 'INSPECTION' && msUntil >= 0) {
      // In maturity window, not yet overdue.
      total += PLANNER_WEIGHTS.INSPECTION_IN_WINDOW
      pushReason(reasons, REASON_LABELS.INSPECTION_IN_WINDOW, PLANNER_WEIGHTS.INSPECTION_IN_WINDOW)
    } else if (item.kind === 'TICKET') {
      if (msUntil < 2 * MS_HOUR) {
        total += PLANNER_WEIGHTS.DUE_UNDER_2H
        pushReason(reasons, REASON_LABELS.DUE_UNDER_2H, PLANNER_WEIGHTS.DUE_UNDER_2H)
      } else if (msUntil < 6 * MS_HOUR) {
        total += PLANNER_WEIGHTS.DUE_UNDER_6H
        pushReason(reasons, REASON_LABELS.DUE_UNDER_6H, PLANNER_WEIGHTS.DUE_UNDER_6H)
      } else {
        const dayDiff = calendarDayDiff(ctx.now, item.dueAt)
        if (dayDiff === 0) {
          total += PLANNER_WEIGHTS.DUE_TODAY
          pushReason(reasons, REASON_LABELS.DUE_TODAY, PLANNER_WEIGHTS.DUE_TODAY)
        } else if (dayDiff === 1) {
          total += PLANNER_WEIGHTS.DUE_TOMORROW
          pushReason(reasons, REASON_LABELS.DUE_TOMORROW, PLANNER_WEIGHTS.DUE_TOMORROW)
        }
      }
    }
  }

  if (ctx.currentLocationId && item.locationId === ctx.currentLocationId) {
    total += PLANNER_WEIGHTS.ALREADY_HERE
    pushReason(reasons, REASON_LABELS.ALREADY_HERE, PLANNER_WEIGHTS.ALREADY_HERE)
  }

  if (item.dispatcherAssigned) {
    total += PLANNER_WEIGHTS.DISPATCHER_ASSIGNED
    pushReason(reasons, REASON_LABELS.DISPATCHER_ASSIGNED, PLANNER_WEIGHTS.DISPATCHER_ASSIGNED)
  }

  if (
    ctx.includeRoadWeight &&
    ctx.technicianLat != null &&
    ctx.technicianLon != null &&
    item.latitude != null &&
    item.longitude != null
  ) {
    const km = haversineKm(ctx.technicianLat, ctx.technicianLon, item.latitude, item.longitude)
    const roadWeight = PLANNER_WEIGHTS.ROAD_PER_KM * km
    total += roadWeight
    // Negative — not included in top positive reasons.
  }

  const topPositive = reasons
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)

  return {
    kind: item.kind,
    id: item.id,
    locationId: item.locationId,
    latitude: item.latitude,
    longitude: item.longitude,
    dueAt: item.dueAt,
    urgent: item.urgent,
    dispatcherAssigned: item.dispatcherAssigned,
    title: item.title,
    summary: item.summary,
    intervalDays: item.intervalDays,
    leadTimeDays: item.leadTimeDays,
    frequency: item.frequency,
    total,
    reasons: topPositive,
  }
}

/**
 * Score candidates and group by location, ordered by descending location weight
 * (best work total). Within each location works are sorted best-first; the best
 * work gets `suggestedFirst: true`.
 *
 * Callers that need the maturity filter should pass `filterMaturedCandidates(...)`
 * first (or use this on an already filtered pool).
 */
export function score(candidates: PlannerPoolItem[], context: PlannerContext): ScoredLocation[] {
  if (candidates.length === 0) return []

  const scored = candidates.map((c) => scoreOne(c, context))

  const byLocation = new Map<string, typeof scored>()
  for (const work of scored) {
    const list = byLocation.get(work.locationId)
    if (list) list.push(work)
    else byLocation.set(work.locationId, [work])
  }

  const locations: ScoredLocation[] = []
  for (const [locationId, works] of byLocation) {
    works.sort((a, b) => b.total - a.total)
    const withFlag: ScoredWork[] = works.map((w, i) => ({
      ...w,
      suggestedFirst: i === 0,
    }))
    locations.push({ locationId, works: withFlag })
  }

  locations.sort((a, b) => b.works[0].total - a.works[0].total)
  return locations
}

/** Alias of {@link score}. */
export const planNext = score
