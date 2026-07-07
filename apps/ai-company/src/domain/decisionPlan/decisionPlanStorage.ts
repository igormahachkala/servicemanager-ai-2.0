/**
 * Decision Plan persistence (AI-COMPANY-102A).
 * Links plans to MAX Worker Loop and Runtime runs — not Runtime orchestrator.
 */

import type { DecisionPlan } from './decisionPlan'
import { parseDecisionPlan } from './decisionPlan'

export const DECISION_PLAN_STORAGE_KEY = 'ai-company-decision-plans'

export const DECISION_PLAN_SYNC_EVENT = 'ai-company-decision-plan-sync'

export type DecisionPlanRecord = {
  plan: DecisionPlan
  employeeId: string
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  savedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRecord(value: unknown): DecisionPlanRecord | null {
  if (!isRecord(value)) return null
  const plan = parseDecisionPlan(value.plan)
  if (!plan || typeof value.employeeId !== 'string' || typeof value.savedAt !== 'string') {
    return null
  }
  return {
    plan,
    employeeId: value.employeeId,
    maxWorkerLoopId: typeof value.maxWorkerLoopId === 'string' ? value.maxWorkerLoopId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    savedAt: value.savedAt,
  }
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DECISION_PLAN_SYNC_EVENT))
}

export function loadDecisionPlanRecords(): DecisionPlanRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DECISION_PLAN_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseRecord).filter((item): item is DecisionPlanRecord => item !== null)
  } catch {
    return []
  }
}

function saveRecords(records: DecisionPlanRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DECISION_PLAN_STORAGE_KEY, JSON.stringify(records))
    emitSync()
  } catch {
    /* noop */
  }
}

export function saveDecisionPlanRecord(record: DecisionPlanRecord): void {
  const existing = loadDecisionPlanRecords()
  const index = existing.findIndex((item) => item.plan.id === record.plan.id)
  if (index >= 0) {
    const copy = [...existing]
    copy[index] = record
    saveRecords(copy)
    return
  }
  saveRecords([record, ...existing])
}

export function getDecisionPlanRecordById(planId: string): DecisionPlanRecord | null {
  return loadDecisionPlanRecords().find((item) => item.plan.id === planId) ?? null
}

export function getDecisionPlanByLoopId(loopId: string): DecisionPlan | null {
  return loadDecisionPlanRecords().find((item) => item.maxWorkerLoopId === loopId)?.plan ?? null
}

export function getDecisionPlanRecordByLoopId(loopId: string): DecisionPlanRecord | null {
  return loadDecisionPlanRecords().find((item) => item.maxWorkerLoopId === loopId) ?? null
}

export function getDecisionPlanByRuntimeRunId(runId: string): DecisionPlan | null {
  return loadDecisionPlanRecords().find((item) => item.runtimeRunId === runId)?.plan ?? null
}

export function getDecisionPlanRecordByRuntimeRunId(runId: string): DecisionPlanRecord | null {
  return loadDecisionPlanRecords().find((item) => item.runtimeRunId === runId) ?? null
}

export function linkDecisionPlanRuntimeRun(planId: string, runtimeRunId: string): void {
  const records = loadDecisionPlanRecords()
  const index = records.findIndex((item) => item.plan.id === planId)
  if (index < 0) return
  const copy = [...records]
  copy[index] = { ...copy[index], runtimeRunId, savedAt: new Date().toISOString() }
  saveRecords(copy)
}
