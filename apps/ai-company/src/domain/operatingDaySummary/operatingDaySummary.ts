/**
 * Employee Operating Day Summary — domain types (AI-COMPANY-104C).
 * Internal end-of-day recap for the digital employee (not Owner Morning Report).
 */

import type { EmployeeWorkday } from '../workday/workday'

export const EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION = 'v1' as const

export const OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE = 'employee_operating_day_summary_v1' as const

export type OperatingDaySummaryMorningReportSource =
  typeof OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE

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

export type OperatingDaySummaryConsultation = {
  peerEmployeeId: string
  peerDisplayName: string | null
  reason: string | null
  outcome: string | null
}

export type OperatingDaySummaryReport = {
  reportId: string
  title: string
  href: string | null
  summary: string | null
}

export type OperatingDaySummaryMemoryDraft = {
  id: string
  title: string
  preview: string
  category: string | null
}

export type OperatingDaySummaryKnowledgeCandidate = {
  id: string
  title: string
  summary: string
  type: string | null
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
  operatingDayId: string | null
  operatingDaySessionId: string | null
  workdayId: string | null
  startedAt: string | null
  finishedAt: string
  workDurationMs: number
  tasksCompletedCount: number
  tasksRemainingCount: number
  tasksBlockedCount: number
  tasksCompleted: OperatingDaySummaryTaskCompleted[]
  decisionsMade: OperatingDaySummaryDecision[]
  toolsUsed: OperatingDaySummaryToolUsage[]
  modelsUsed: OperatingDaySummaryModelUsage[]
  consultations: OperatingDaySummaryConsultation[]
  reportsCreated: OperatingDaySummaryReport[]
  memoryDrafts: OperatingDaySummaryMemoryDraft[]
  knowledgeCandidates: OperatingDaySummaryKnowledgeCandidate[]
  difficulties: OperatingDaySummaryDifficulty[]
  remainingWork: OperatingDaySummaryRemainingItem[]
  nextDayRecommendations: string[]
  journalEntryIds: string[]
  workerLoopIds: string[]
  decisionPlanIds: string[]
  consultationCount: number
  /** Future Morning Report primary source marker — not Owner Morning Report itself. */
  morningReportSource: OperatingDaySummaryMorningReportSource
  morningReportEligible: boolean
  generatedAt: string
}

export type BuildEmployeeOperatingDaySummaryInput = {
  employeeId: string
  dateKey: string
  workday?: EmployeeWorkday | null
  operatingDayId?: string | null
  operatingDaySessionId?: string | null
  sessionStartedAt?: string | null
  finishedAt?: string | null
  now?: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createEmployeeOperatingDaySummaryId(now: Date = new Date()): string {
  return `op-day-summary-${now.getTime()}`
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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
    typeof value.generatedAt !== 'string'
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

  const parseConsultations = (items: unknown): OperatingDaySummaryConsultation[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryConsultation | null => {
        if (!isRecord(item) || typeof item.peerEmployeeId !== 'string') return null
        return {
          peerEmployeeId: item.peerEmployeeId,
          peerDisplayName: typeof item.peerDisplayName === 'string' ? item.peerDisplayName : null,
          reason: typeof item.reason === 'string' ? item.reason : null,
          outcome: typeof item.outcome === 'string' ? item.outcome : null,
        }
      })
      .filter((item): item is OperatingDaySummaryConsultation => item !== null)
  }

  const parseReports = (items: unknown): OperatingDaySummaryReport[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryReport | null => {
        if (!isRecord(item) || typeof item.reportId !== 'string' || typeof item.title !== 'string') {
          return null
        }
        return {
          reportId: item.reportId,
          title: item.title,
          href: typeof item.href === 'string' ? item.href : null,
          summary: typeof item.summary === 'string' ? item.summary : null,
        }
      })
      .filter((item): item is OperatingDaySummaryReport => item !== null)
  }

  const parseMemoryDrafts = (items: unknown): OperatingDaySummaryMemoryDraft[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryMemoryDraft | null => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') {
          return null
        }
        return {
          id: item.id,
          title: item.title,
          preview: typeof item.preview === 'string' ? item.preview : '',
          category: typeof item.category === 'string' ? item.category : null,
        }
      })
      .filter((item): item is OperatingDaySummaryMemoryDraft => item !== null)
  }

  const parseKnowledgeCandidates = (items: unknown): OperatingDaySummaryKnowledgeCandidate[] => {
    if (!Array.isArray(items)) return []
    return items
      .map((item): OperatingDaySummaryKnowledgeCandidate | null => {
        if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') {
          return null
        }
        return {
          id: item.id,
          title: item.title,
          summary: typeof item.summary === 'string' ? item.summary : '',
          type: typeof item.type === 'string' ? item.type : null,
        }
      })
      .filter((item): item is OperatingDaySummaryKnowledgeCandidate => item !== null)
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

  const morningReportSource =
    value.morningReportSource === OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE
      ? OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE
      : OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE

  return {
    id: value.id,
    version: EMPLOYEE_OPERATING_DAY_SUMMARY_VERSION,
    employeeId: value.employeeId,
    dateKey: value.dateKey,
    operatingDayId: typeof value.operatingDayId === 'string' ? value.operatingDayId : null,
    operatingDaySessionId:
      typeof value.operatingDaySessionId === 'string' ? value.operatingDaySessionId : null,
    workdayId: typeof value.workdayId === 'string' ? value.workdayId : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: value.finishedAt,
    workDurationMs: typeof value.workDurationMs === 'number' ? value.workDurationMs : 0,
    tasksCompletedCount: value.tasksCompletedCount,
    tasksRemainingCount:
      typeof value.tasksRemainingCount === 'number' ? value.tasksRemainingCount : 0,
    tasksBlockedCount: typeof value.tasksBlockedCount === 'number' ? value.tasksBlockedCount : 0,
    tasksCompleted: parseTasks(value.tasksCompleted),
    decisionsMade: parseDecisions(value.decisionsMade),
    toolsUsed: parseTools(value.toolsUsed),
    modelsUsed: parseModels(value.modelsUsed),
    consultations: parseConsultations(value.consultations),
    reportsCreated: parseReports(value.reportsCreated),
    memoryDrafts: parseMemoryDrafts(value.memoryDrafts),
    knowledgeCandidates: parseKnowledgeCandidates(value.knowledgeCandidates),
    difficulties: parseDifficulties(value.difficulties),
    remainingWork: parseRemaining(value.remainingWork),
    nextDayRecommendations: parseStringArray(value.nextDayRecommendations),
    journalEntryIds: parseStringArray(value.journalEntryIds),
    workerLoopIds: parseStringArray(value.workerLoopIds),
    decisionPlanIds: parseStringArray(value.decisionPlanIds),
    consultationCount:
      typeof value.consultationCount === 'number'
        ? value.consultationCount
        : parseConsultations(value.consultations).length,
    morningReportSource,
    morningReportEligible:
      typeof value.morningReportEligible === 'boolean' ? value.morningReportEligible : false,
    generatedAt: value.generatedAt,
  }
}
