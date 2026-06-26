export const WORKDAY_PHASES = [
  'day_start',
  'agenda',
  'check_notifications',
  'check_approvals',
  'read_knowledge',
  'execute_tasks',
  'create_reports',
  'review',
  'finish_day',
] as const

export type WorkdayPhase = (typeof WORKDAY_PHASES)[number]

export const WORKDAY_PHASE_ORDER: WorkdayPhase[] = [...WORKDAY_PHASES]

export function nextWorkdayPhase(phase: WorkdayPhase): WorkdayPhase | null {
  const index = WORKDAY_PHASE_ORDER.indexOf(phase)
  if (index < 0 || index >= WORKDAY_PHASE_ORDER.length - 1) return null
  return WORKDAY_PHASE_ORDER[index + 1] ?? null
}

export function workdayPhaseIndex(phase: WorkdayPhase): number {
  return WORKDAY_PHASE_ORDER.indexOf(phase)
}

export function isWorkdayPhaseComplete(current: WorkdayPhase, target: WorkdayPhase): boolean {
  return workdayPhaseIndex(current) > workdayPhaseIndex(target)
}

export function scheduledDayStartIso(date = new Date()): string {
  const start = new Date(date)
  start.setHours(8, 0, 0, 0)
  return start.toISOString()
}
