/**
 * Employee Operating Day Summary — domain types (AI-COMPANY-104C).
 * Internal end-of-day recap for the digital employee (not Owner Morning Report).
 */

import type { EmployeeWorkday } from '../workday/workday'

export const EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION = 'v1' as const

export type OperatingDaySummaryTaskCompleted = {
  journalEntryId: string | null
  workItemId: string | null
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  reportId: string | null
  title: string
  finishedAt: string
}

export type OperatingDaySummaryDecision = {
  summary: string
  rationale: string | null
  source: 'decision_plan' | 'peer_consult' | 'owner_approval' | 'runtime' | 'journal' | null
}

export type OperatingDaySummaryToolUsage = {
  toolId: string
  label: string
  usageCount: number
  reason: string | null
}

export type OperatingDaySummaryModelUsage = {
  modelId: string
  label: string
  role: string
  usageCount: number
}

export type OperatingDaySummaryDifficulty = {
  id: string
  kind: 'worker_loop_failed' | 'queue_blocked' | 'peer_consult' | 'owner_approval' | 'agenda_incomplete'
  summary: string
  detail: string | null
}

export type OperatingDaySummaryRemainingItem = {
  id: string
  kind: 'work_queue' | 'agenda'
  title: string
  status: string
  detail: string | null
}

export type EmployeeOperatingDaySummary = {
  id: string
  version: typeof EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION
  employeeId: string
  dateKey: string
  workdayId: string | null
  startedAt: string | null
  finishedAt: string
  tasksCompletedCount: number
  tasksCompleted: OperatingDaySummaryTaskCompleted[]
  decisionsMade: OperatingDaySummaryDecision[]
  toolsUsed: OperatingDaySummaryToolUsage[]
  modelsUsed: OperatingDaySummaryModelUsage[]
  difficulties: OperatingDaySummaryDifficulty[]
  remainingWork: OperatingDaySummaryRemainingItem[]
  nextDayRecommendations: string[]
  journalEntryIds: string[]
  workerLoopIds: string[]
  decisionPlanIds: string[]
  consultationCount: number
  generatedAt: string
}

export type BuildEmployeeOperatingDaySummaryInput = {
  employeeId: string
  dateKey: string
  workday?: EmployeeWorkday | null
  finishedAt?: string | null
  now?: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createEmployeeOperatingDaySummaryId(now: Date = new Date()): string {
  return `op-day-summary-${now.getTime()}`
}

export function parseEmployeeOperatingDaySummary(value: unknown): EmployeeOperatingDaySummary | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.version !== EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION ||
    typeof value.employeeId !== 'string' ||
    typeof value.dateKey !== 'string' ||
    typeof value.finishedAt !== 'string' ||
    typeof value.tasksCompletedCount !== 'number' ||
    typeof value.generatedAt !== 'string' ||
    typeof value.consultationCount !== 'number'
  ) {
    return null
  }

  const parseTasks = (items: unknown): OperatingDaySummaryTaskCompleted[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryTaskCompleted | null => {
        if (!isRecord(item) || typeof item.title !== 'string' || typeof item.finishedAt !== 'string') {
          return null
        }
        return {
          journalEntryId: typeof item.journalEntryId === 'string' ? item.journalEntryId : null,
          workItemId: typeof item.workItemId === 'string' ? item.workItemId : null,
          maxWorkerLoopId: typeof item.maxWorkerLoopId === 'string' ? item.maxWorkerLoopId : null,
          runtimeRunId: typeof item.runtimeRunId === 'string' ? item.runtimeRunId : null,
          reportId: typeof item.reportId === 'string' ? item.reportId : null,
          title: item.title,
          finishedAt: item.finishedAt,
        }
      })
      .filter((item): item is OperatingDaySummaryTaskCompleted => item !== null)
  }

  const parseDecisions = (items: unknown): OperatingDaySummaryDecision[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryDecision | null => {
        if (!isRecord(item) || typeof item.summary !== 'string') return null
        const source = item.source
        return {
          summary: item.summary,
          rationale: typeof item.rationale === 'string' ? item.rationale : null,
          source:
            source === 'decision_plan' ||
            source === 'peer_consult' ||
            source === 'owner_approval' ||
            source === 'runtime' ||
            source === 'journal'
              ? source
              : null,
        }
      })
      .filter((item): item is OperatingDaySummaryDecision => item !== null)
  }

  const parseTools = (items: unknown): OperatingDaySummaryToolUsage[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryToolUsage | null => {
        if (!isRecord(item) || typeof item.toolId !== 'string' || typeof item.label !== 'string') {
          return null
        }
        return {
          toolId: item.toolId,
          label: item.label,
          usageCount: typeof item.usageCount === 'number' ? item.usageCount : 1,
          reason: typeof item.reason === 'string' ? item.reason : null,
        }
      })
      .filter((item): item is OperatingDaySummaryToolUsage => item !== null)
  }

  const parseModels = (items: unknown): OperatingDaySummaryModelUsage[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryModelUsage | null => {
        if (!isRecord(item) || typeof item.modelId !== 'string' || typeof item.label !== 'string') {
          return null
        }
        return {
          modelId: item.modelId,
          label: item.label,
          role: typeof item.role === 'string' ? item.role : 'reasoning',
          usageCount: typeof item.usageCount === 'number' ? item.usageCount : 1,
        }
      })
      .filter((item): item is OperatingDaySummaryModelUsage => item !== null)
  }

  const parseDifficulties = (items: unknown): OperatingDaySummaryDifficulty[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryDifficulty | null => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.summary !== 'string') {
          return null
        }
        const kind = item.kind
        if (
          kind !== 'worker_loop_failed' &&
          kind !== 'queue_blocked' &&
          kind !== 'peer_consult' &&
          kind !== 'owner_approval' &&
          kind !== 'agenda_incomplete'
        ) {
          return null
        }
        return {
          id: item.id,
          kind,
          summary: item.summary,
          detail: typeof item.detail === 'string' ? item.detail : null,
        }
      })
      .filter((item): item is OperatingDaySummaryDifficulty => item !== null)
  }

  const parseRemaining = (items: unknown): OperatingDaySummaryRemainingItem[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryRemainingItem | null => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') {
          return null
        }
        const kind = item.kind
        if (kind !== 'work_queue' && kind !== 'agenda') return null
        return {
          id: item.id,
          kind,
          title: item.title,
          status: typeof item.status === 'string' ? item.status : 'pending',
          detail: typeof item.detail === 'string' ? item.detail : null,
        }
      })
      .filter((item): item is OperatingDaySummaryRemainingItem => item !== null)
  }

  return {
    id: value.id,
    version: EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION,
    employeeId: value.employeeId,
    dateKey: value.dateKey,
    workdayId: typeof value.workdayId === 'string' ? value.workdayId : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: value.finishedAt,
    tasksCompletedCount: value.tasksCompletedCount,
    tasksCompleted: parseTasks(value.tasksCompleted),
    decisionsMade: parseDecisions(value.decisionsMade),
    toolsUsed: parseTools(value.toolsUsed),
    modelsUsed: parseModels(value.modelsUsed),
    difficulties: parseDifficulties(value.difficulties),
    remainingWork: parseRemaining(value.remainingWork),
    nextDayRecommendations: Array.isArray(value.nextDayRecommendations)
      ? value.nextDayRecommendations.filter((item): item is string => typeof item === 'string')
      : [],
    journalEntryIds: Array.isArray(value.journalEntryIds)
      ? value.journalEntryIds.filter((item): item is string => typeof item === 'string')
      : [],
    workerLoopIds: Array.isArray(value.workerLoopIds)
      ? value.workerLoopIds.filter((item): item is string => typeof item === 'string')
      : [],
    decisionPlanIds: Array.isArray(value.decisionPlanIds)
      ? value.decisionPlanIds.filter((item): item is string => typeof item === 'string')
      : [],
    consultationCount: value.consultationCount,
    generatedAt: value.generatedAt,
  }
}
