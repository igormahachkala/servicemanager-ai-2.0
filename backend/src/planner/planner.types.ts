/** Pool item kinds for the technician planner. */
export type PlannerWorkKind = 'TICKET' | 'INSPECTION'

/**
 * InspectionFrequency string values (and CUSTOM). Kept as string so the scoring
 * layer does not import Prisma.
 */
export type PlannerFrequency =
  | 'ONCE'
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'CUSTOM'
  | (string & {})

/** One candidate work item in the planner pool. */
export interface PlannerPoolItem {
  kind: PlannerWorkKind
  id: string
  locationId: string
  latitude?: number | null
  longitude?: number | null
  /** Ticket: slaDueAt. Inspection: nextDueAt. */
  dueAt: Date | null
  /** Ticket urgency === URGENT. */
  urgent: boolean
  /** Assigned by a dispatcher (not self-picked). */
  dispatcherAssigned: boolean
  title?: string | null
  summary?: string | null
  intervalDays?: number | null
  leadTimeDays?: number | null
  /** Inspection: льготные дни плана — до их исхода визит ещё не просрочен. */
  graceDays?: number | null;
  frequency?: PlannerFrequency | null
}

/** Scoring / planning context for one technician at one moment. */
export interface PlannerContext {
  now: Date
  currentLocationId: string | null
  technicianLat?: number | null
  technicianLon?: number | null
  /** When true and both points exist, apply −2/km road penalty. */
  includeRoadWeight?: boolean
}

export interface ScoreReason {
  label: string
  weight: number
}

/** One scored work, ready for display / ordering. */
export interface ScoredWork {
  kind: PlannerWorkKind
  id: string
  locationId: string
  latitude?: number | null
  longitude?: number | null
  dueAt: Date | null
  urgent: boolean
  dispatcherAssigned: boolean
  title?: string | null
  summary?: string | null
  intervalDays?: number | null
  leadTimeDays?: number | null
  frequency?: PlannerFrequency | null
  total: number
  /** Top positive reasons, up to 3, by weight descending. */
  reasons: ScoreReason[]
  /** True on the best work of its location group. */
  suggestedFirst: boolean
}

/** Location group: works sorted best-first. */
export interface ScoredLocation {
  locationId: string
  works: ScoredWork[]
}
