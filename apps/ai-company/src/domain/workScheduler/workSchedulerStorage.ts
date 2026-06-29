import {
  WORK_SUGGESTION_KINDS,
  WORK_SUGGESTION_STATUSES,
  type WorkSchedulerPlan,
  type WorkSuggestion,
  type WorkSuggestionKind,
  type WorkSuggestionStatus,
} from './workSchedulerTypes'

export const WORK_SCHEDULER_STORAGE_KEY = 'ai-company-work-scheduler-plans'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseKind(value: unknown): WorkSuggestionKind {
  return typeof value === 'string' && (WORK_SUGGESTION_KINDS as readonly string[]).includes(value)
    ? (value as WorkSuggestionKind)
    : 'next_task'
}

function parseStatus(value: unknown): WorkSuggestionStatus {
  return typeof value === 'string' && (WORK_SUGGESTION_STATUSES as readonly string[]).includes(value)
    ? (value as WorkSuggestionStatus)
    : 'pending_approval'
}

function parsePayload(value: unknown): Record<string, string | null> {
  if (!isRecord(value)) return {}
  const out: Record<string, string | null> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = typeof entry === 'string' ? entry : entry === null ? null : String(entry)
  }
  return out
}

export function parseWorkSuggestion(value: unknown): WorkSuggestion | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.rationale !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.taskResultId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    kind: parseKind(value.kind),
    title: value.title,
    rationale: value.rationale,
    priority:
      value.priority === 'low' || value.priority === 'high' ? value.priority : ('medium' as const),
    status: parseStatus(value.status),
    employeeId: value.employeeId,
    taskResultId: value.taskResultId,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    payload: parsePayload(value.payload),
    createdAt: value.createdAt,
    decidedAt: typeof value.decidedAt === 'string' ? value.decidedAt : null,
    decidedBy: typeof value.decidedBy === 'string' ? value.decidedBy : null,
  }
}

export function parseWorkSchedulerPlan(value: unknown): WorkSchedulerPlan | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.taskResultId !== 'string' ||
    typeof value.runtimeRunId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.analysisSummary !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Array.isArray(value.suggestions)
  ) {
    return null
  }
  const suggestions = value.suggestions
    .map(parseWorkSuggestion)
    .filter((item): item is WorkSuggestion => item !== null)
  if (suggestions.length === 0) return null
  return {
    id: value.id,
    taskResultId: value.taskResultId,
    runtimeRunId: value.runtimeRunId,
    employeeId: value.employeeId,
    analysisSummary: value.analysisSummary,
    suggestions,
    createdAt: value.createdAt,
  }
}

export function loadWorkSchedulerPlans(): WorkSchedulerPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WORK_SCHEDULER_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseWorkSchedulerPlan)
      .filter((item): item is WorkSchedulerPlan => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveWorkSchedulerPlans(plans: WorkSchedulerPlan[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(WORK_SCHEDULER_STORAGE_KEY, JSON.stringify(plans))
  } catch {
    /* noop */
  }
}

export function upsertWorkSchedulerPlan(plan: WorkSchedulerPlan): WorkSchedulerPlan {
  const next = [plan, ...loadWorkSchedulerPlans().filter((item) => item.id !== plan.id)]
  saveWorkSchedulerPlans(next)
  return plan
}

export function getWorkSchedulerPlanById(id: string): WorkSchedulerPlan | null {
  return loadWorkSchedulerPlans().find((item) => item.id === id) ?? null
}

export function getWorkSchedulerPlanByTaskResultId(taskResultId: string): WorkSchedulerPlan | null {
  return loadWorkSchedulerPlans().find((item) => item.taskResultId === taskResultId) ?? null
}

export function patchWorkSchedulerPlan(
  planId: string,
  patch: Partial<Pick<WorkSchedulerPlan, 'analysisSummary' | 'suggestions'>>,
): WorkSchedulerPlan | null {
  const existing = getWorkSchedulerPlanById(planId)
  if (!existing) return null
  const updated: WorkSchedulerPlan = { ...existing, ...patch }
  upsertWorkSchedulerPlan(updated)
  return updated
}

export function patchWorkSuggestion(
  planId: string,
  suggestionId: string,
  patch: Partial<Pick<WorkSuggestion, 'status' | 'decidedAt' | 'decidedBy'>>,
): WorkSchedulerPlan | null {
  const existing = getWorkSchedulerPlanById(planId)
  if (!existing) return null
  const suggestions = existing.suggestions.map((item) =>
    item.id === suggestionId ? { ...item, ...patch } : item,
  )
  return patchWorkSchedulerPlan(planId, { suggestions })
}

export function listPendingWorkSuggestions(options?: {
  employeeId?: string
  projectId?: string
  limit?: number
}): WorkSuggestion[] {
  const limit = options?.limit ?? 24
  const items: WorkSuggestion[] = []
  for (const plan of loadWorkSchedulerPlans()) {
    if (options?.employeeId && plan.employeeId !== options.employeeId) continue
    if (options?.projectId) {
      const projectId = plan.suggestions[0]?.projectId
      if (projectId && projectId !== options.projectId) continue
    }
    for (const suggestion of plan.suggestions) {
      if (suggestion.status !== 'pending_approval') continue
      items.push(suggestion)
      if (items.length >= limit) return items
    }
  }
  return items
}

export function countWorkSuggestionsByStatus(status: WorkSuggestionStatus): number {
  return loadWorkSchedulerPlans().reduce(
    (sum, plan) => sum + plan.suggestions.filter((item) => item.status === status).length,
    0,
  )
}
