/**
 * Builder Tool Decision — localStorage (AI-COMPANY-113B).
 */

import type { BuilderToolDecision } from './builderToolDecisionTypes'
import { BUILDER_TOOL_DECISION_VERSION } from './builderToolDecisionTypes'

export const BUILDER_TOOL_DECISION_STORAGE_KEY = 'ai-company-builder-tool-decisions'

export const BUILDER_TOOL_DECISION_SYNC_EVENT = 'ai-company-builder-tool-decision-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(BUILDER_TOOL_DECISION_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseDecision(value: unknown): BuilderToolDecision | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.version !== BUILDER_TOOL_DECISION_VERSION) return null
  if (typeof value.employeeId !== 'string' || typeof value.workItemId !== 'string') return null
  if (typeof value.workerLoopId !== 'string' || typeof value.reason !== 'string') return null
  if (typeof value.toolRequired !== 'boolean') return null

  return {
    id: value.id,
    version: BUILDER_TOOL_DECISION_VERSION,
    employeeId: value.employeeId,
    workItemId: value.workItemId,
    workerLoopId: value.workerLoopId,
    decisionPlanId: typeof value.decisionPlanId === 'string' ? value.decisionPlanId : null,
    outcome:
      value.outcome === 'local_model_analysis' ||
      value.outcome === 'code_change_cursor' ||
      value.outcome === 'no_tool'
        ? value.outcome
        : 'no_tool',
    toolRequired: value.toolRequired,
    recommendedToolId: value.recommendedToolId === 'cursor' ? 'cursor' : null,
    reason: value.reason,
    risk:
      value.risk === 'high' || value.risk === 'medium' || value.risk === 'low' ? value.risk : 'low',
    fileScope: Array.isArray(value.fileScope)
      ? value.fileScope.filter((item): item is string => typeof item === 'string')
      : [],
    expectedResult: typeof value.expectedResult === 'string' ? value.expectedResult : '',
    checks: Array.isArray(value.checks)
      ? value.checks.filter((item): item is string => typeof item === 'string')
      : [],
    confidence: typeof value.confidence === 'number' ? value.confidence : 0,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

export function createBuilderToolDecisionId(): string {
  return `btd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function loadBuilderToolDecisions(): BuilderToolDecision[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BUILDER_TOOL_DECISION_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseDecision)
      .filter((item): item is BuilderToolDecision => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

export function saveBuilderToolDecisions(decisions: BuilderToolDecision[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BUILDER_TOOL_DECISION_STORAGE_KEY, JSON.stringify(decisions))
  emitSync()
}

export function upsertBuilderToolDecision(decision: BuilderToolDecision): BuilderToolDecision {
  const list = loadBuilderToolDecisions()
  const next = [decision, ...list.filter((item) => item.id !== decision.id)]
  saveBuilderToolDecisions(next)
  return decision
}

export function getBuilderToolDecisionById(id: string): BuilderToolDecision | null {
  return loadBuilderToolDecisions().find((item) => item.id === id) ?? null
}

export function getBuilderToolDecisionByWorkerLoopId(workerLoopId: string): BuilderToolDecision | null {
  return loadBuilderToolDecisions().find((item) => item.workerLoopId === workerLoopId) ?? null
}

export function listBuilderToolDecisionsForWorkItem(workItemId: string): BuilderToolDecision[] {
  return loadBuilderToolDecisions().filter((item) => item.workItemId === workItemId)
}
