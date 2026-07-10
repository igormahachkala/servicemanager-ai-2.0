/**
 * Delegation Plan — localStorage persistence & API (AI-COMPANY-112D).
 */

import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import {
  DELEGATION_PLAN_STORAGE_KEY,
  DELEGATION_PLAN_SYNC_EVENT,
  DELEGATION_PLAN_VERSION,
  type CreateDelegationPlanInput,
  type DelegationPlanHistoryEntry,
  type DelegationPlanHistoryKind,
  type DelegationPlanOwnerDecision,
  type DelegationPlanRecord,
  type DelegationPlanStatus,
  type ListDelegationPlansFilter,
} from './delegationPlanTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DELEGATION_PLAN_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type StoreSnapshot = {
  version: typeof DELEGATION_PLAN_VERSION
  plans: DelegationPlanRecord[]
  updatedAt: string
}

function emptySnapshot(): StoreSnapshot {
  return { version: DELEGATION_PLAN_VERSION, plans: [], updatedAt: nowIso() }
}

function readSnapshot(): StoreSnapshot {
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(DELEGATION_PLAN_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== DELEGATION_PLAN_VERSION) return emptySnapshot()
    return {
      version: DELEGATION_PLAN_VERSION,
      plans: Array.isArray(parsed.plans) ? (parsed.plans as DelegationPlanRecord[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(snapshot: StoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    DELEGATION_PLAN_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: nowIso() }),
  )
  emitSync()
}

function appendHistory(
  history: DelegationPlanHistoryEntry[],
  kind: DelegationPlanHistoryKind,
  message: string | null = null,
): DelegationPlanHistoryEntry[] {
  return [
    ...history,
    {
      id: createId('dph'),
      kind,
      at: nowIso(),
      message,
    },
  ]
}

function resolveInitialStatus(requiresOwnerApproval: boolean): DelegationPlanStatus {
  return requiresOwnerApproval ? 'awaiting_owner' : 'proposed'
}

function resolveInitialOwnerDecision(requiresOwnerApproval: boolean): DelegationPlanOwnerDecision {
  return requiresOwnerApproval ? 'pending' : 'pending'
}

export function createDelegationPlan(input: CreateDelegationPlanInput): DelegationPlanRecord {
  const requiresOwnerApproval =
    input.requiresOwnerApproval ??
    input.recommendedEmployeeId !== DELEGATION_DECIDER_EMPLOYEE_ID

  const createdAt = nowIso()
  const initialStatus = resolveInitialStatus(requiresOwnerApproval)

  const record: DelegationPlanRecord = {
    id: createId('dplan'),
    version: DELEGATION_PLAN_VERSION,
    companyId: input.companyId,
    originEmployeeId: input.originEmployeeId,
    recommendedEmployeeId: input.recommendedEmployeeId,
    recommendedEmployeeCodename: input.recommendedEmployeeCodename,
    recommendedEmployeeRole: input.recommendedEmployeeRole,
    taskTitle: input.taskTitle.trim(),
    taskText: input.taskText.trim(),
    structuredPayload: input.structuredPayload,
    confidence: input.confidence,
    ownerExplanation: input.ownerExplanation,
    rationale: input.rationale,
    alternatives: input.alternatives,
    matchedSignals: input.matchedSignals,
    risk: input.risk,
    status: initialStatus,
    createdAt,
    decidedAt: null,
    ownerDecision: resolveInitialOwnerDecision(requiresOwnerApproval),
    targetWorkItemId: null,
    sourceTaskId: input.sourceTaskId ?? null,
    requiresOwnerApproval,
    history: appendHistory(
      [],
      'proposed',
      `MAX предложил делегирование → ${input.recommendedEmployeeCodename}`,
    ),
  }

  if (requiresOwnerApproval) {
    record.history = appendHistory(
      record.history,
      'awaiting_owner',
      'Ожидает решения Owner',
    )
  }

  const snapshot = readSnapshot()
  snapshot.plans.unshift(record)
  writeSnapshot(snapshot)
  return record
}

export function getDelegationPlan(id: string): DelegationPlanRecord | null {
  return readSnapshot().plans.find((item) => item.id === id) ?? null
}

export function listDelegationPlans(filter: ListDelegationPlansFilter = {}): DelegationPlanRecord[] {
  let plans = readSnapshot().plans

  if (filter.companyId) {
    plans = plans.filter((item) => item.companyId === filter.companyId)
  }

  if (filter.awaitingOwnerOnly) {
    plans = plans.filter((item) => item.status === 'awaiting_owner')
  }

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    plans = plans.filter((item) => statuses.includes(item.status))
  }

  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function updatePlan(
  id: string,
  updater: (plan: DelegationPlanRecord) => DelegationPlanRecord | null,
): DelegationPlanRecord | null {
  const snapshot = readSnapshot()
  const index = snapshot.plans.findIndex((item) => item.id === id)
  if (index < 0) return null

  const next = updater(snapshot.plans[index])
  if (!next) return null

  snapshot.plans[index] = next
  writeSnapshot(snapshot)
  return next
}

export function approveDelegationPlan(id: string): DelegationPlanRecord | null {
  return updatePlan(id, (plan) => {
    if (plan.status !== 'awaiting_owner' && plan.status !== 'proposed') return null

    const decidedAt = nowIso()
    return {
      ...plan,
      status: 'approved',
      ownerDecision: 'approved',
      decidedAt,
      history: appendHistory(
        plan.history,
        'approved',
        `Owner одобрил делегирование → ${plan.recommendedEmployeeCodename}`,
      ),
    }
  })
}

export function rejectDelegationPlan(id: string, reason: string | null = null): DelegationPlanRecord | null {
  return updatePlan(id, (plan) => {
    if (plan.status !== 'awaiting_owner' && plan.status !== 'proposed') return null

    const decidedAt = nowIso()
    return {
      ...plan,
      status: 'rejected',
      ownerDecision: 'rejected',
      decidedAt,
      history: appendHistory(
        plan.history,
        'rejected',
        reason ?? `Owner отклонил делегирование → ${plan.recommendedEmployeeCodename}`,
      ),
    }
  })
}

export function markDelegationPlanDelegated(
  id: string,
  targetWorkItemId: string | null = null,
): DelegationPlanRecord | null {
  return updatePlan(id, (plan) => {
    if (plan.status !== 'approved') return null

    return {
      ...plan,
      status: 'delegated',
      targetWorkItemId,
      history: appendHistory(
        plan.history,
        'delegated',
        targetWorkItemId
          ? `План передан исполнителю (work item ${targetWorkItemId})`
          : 'План отмечен как delegated',
      ),
    }
  })
}

export function cancelDelegationPlan(id: string, reason: string | null = null): DelegationPlanRecord | null {
  return updatePlan(id, (plan) => {
    if (plan.status === 'delegated' || plan.status === 'cancelled') return null

    return {
      ...plan,
      status: 'cancelled',
      decidedAt: plan.decidedAt ?? nowIso(),
      history: appendHistory(plan.history, 'cancelled', reason ?? 'План делегирования отменён'),
    }
  })
}

export function markDelegationPlanFailed(
  id: string,
  reason: string | null = null,
): DelegationPlanRecord | null {
  return updatePlan(id, (plan) => ({
    ...plan,
    status: 'failed',
    history: appendHistory(plan.history, 'failed', reason ?? 'Делегирование не удалось'),
  }))
}

export function upsertDelegationPlan(record: DelegationPlanRecord): DelegationPlanRecord {
  const snapshot = readSnapshot()
  const index = snapshot.plans.findIndex((item) => item.id === record.id)
  if (index >= 0) snapshot.plans[index] = record
  else snapshot.plans.unshift(record)
  writeSnapshot(snapshot)
  return record
}
