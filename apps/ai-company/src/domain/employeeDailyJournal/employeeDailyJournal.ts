/**
 * Employee Daily Journal — domain types (AI-COMPANY-103C).
 * Operational work log for Owner; feeds Morning Report later.
 * Not Memory, Knowledge, or Experience.
 */

export const EMPLOYEE_DAILY_JOURNAL_VERSION = 'v1' as const

export type EmployeeDailyJournalReportLink = {
  reportId: string
  title: string
  href: string
  summary: string | null
}

export type EmployeeDailyJournalToolUsage = {
  toolId: string
  label: string
  reason: string | null
}

export type EmployeeDailyJournalModelUsage = {
  modelId: string
  label: string
  role: 'primary' | 'secondary' | 'verification' | 'reasoning'
  ollamaTag: string | null
  reason: string | null
}

export type EmployeeDailyJournalConsultation = {
  peerEmployeeId: string
  peerDisplayName: string | null
  reason: string | null
  outcome: string | null
}

export type EmployeeDailyJournalDecision = {
  summary: string
  rationale: string | null
  source: 'decision_plan' | 'peer_consult' | 'owner_approval' | 'runtime' | null
}

export type EmployeeDailyJournalEntry = {
  id: string
  version: typeof EMPLOYEE_DAILY_JOURNAL_VERSION
  employeeId: string
  /** YYYY-MM-DD — calendar day of finishedAt in local build context (UTC slice). */
  dateKey: string
  startedAt: string
  finishedAt: string
  taskTitle: string | null
  taskText: string
  /** Что сделал сотрудник по задаче. */
  workSummary: string
  /** Итог / результат выполнения. */
  resultSummary: string
  toolsUsed: EmployeeDailyJournalToolUsage[]
  modelsUsed: EmployeeDailyJournalModelUsage[]
  consultations: EmployeeDailyJournalConsultation[]
  decisions: EmployeeDailyJournalDecision[]
  reportLinks: EmployeeDailyJournalReportLink[]
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  taskId: string | null
  projectId: string | null
  workspaceId: string | null
  recordedAt: string
}

export type EmployeeDailyJournalFilter = {
  employeeId?: string
  dateKey?: string
  from?: string
  to?: string
  limit?: number
}

export type EmployeeDailyJournalDaySummary = {
  employeeId: string
  dateKey: string
  entryCount: number
  entries: EmployeeDailyJournalEntry[]
  firstStartedAt: string | null
  lastFinishedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createEmployeeDailyJournalEntryId(now: Date = new Date()): string {
  return `journal-${now.getTime()}`
}

export function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function parseReportLink(value: unknown): EmployeeDailyJournalReportLink | null {
  if (!isRecord(value)) return null
  if (typeof value.reportId !== 'string' || typeof value.title !== 'string' || typeof value.href !== 'string') {
    return null
  }
  return {
    reportId: value.reportId,
    title: value.title,
    href: value.href,
    summary: typeof value.summary === 'string' ? value.summary : null,
  }
}

function parseToolUsage(value: unknown): EmployeeDailyJournalToolUsage | null {
  if (!isRecord(value) || typeof value.toolId !== 'string' || typeof value.label !== 'string') return null
  return {
    toolId: value.toolId,
    label: value.label,
    reason: typeof value.reason === 'string' ? value.reason : null,
  }
}

function parseModelUsage(value: unknown): EmployeeDailyJournalModelUsage | null {
  if (!isRecord(value) || typeof value.modelId !== 'string' || typeof value.label !== 'string') return null
  const role = value.role
  if (role !== 'primary' && role !== 'secondary' && role !== 'verification' && role !== 'reasoning') {
    return null
  }
  return {
    modelId: value.modelId,
    label: value.label,
    role,
    ollamaTag: typeof value.ollamaTag === 'string' ? value.ollamaTag : null,
    reason: typeof value.reason === 'string' ? value.reason : null,
  }
}

function parseConsultation(value: unknown): EmployeeDailyJournalConsultation | null {
  if (!isRecord(value) || typeof value.peerEmployeeId !== 'string') return null
  return {
    peerEmployeeId: value.peerEmployeeId,
    peerDisplayName: typeof value.peerDisplayName === 'string' ? value.peerDisplayName : null,
    reason: typeof value.reason === 'string' ? value.reason : null,
    outcome: typeof value.outcome === 'string' ? value.outcome : null,
  }
}

function parseDecision(value: unknown): EmployeeDailyJournalDecision | null {
  if (!isRecord(value) || typeof value.summary !== 'string') return null
  const source = value.source
  return {
    summary: value.summary,
    rationale: typeof value.rationale === 'string' ? value.rationale : null,
    source:
      source === 'decision_plan' ||
      source === 'peer_consult' ||
      source === 'owner_approval' ||
      source === 'runtime'
        ? source
        : null,
  }
}

export function parseEmployeeDailyJournalEntry(value: unknown): EmployeeDailyJournalEntry | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.version !== EMPLOYEE_DAILY_JOURNAL_VERSION ||
    typeof value.employeeId !== 'string' ||
    typeof value.dateKey !== 'string' ||
    typeof value.startedAt !== 'string' ||
    typeof value.finishedAt !== 'string' ||
    typeof value.taskText !== 'string' ||
    typeof value.workSummary !== 'string' ||
    typeof value.resultSummary !== 'string' ||
    typeof value.recordedAt !== 'string'
  ) {
    return null
  }

  const reportLinks = Array.isArray(value.reportLinks)
    ? value.reportLinks.map(parseReportLink).filter((item): item is EmployeeDailyJournalReportLink => item !== null)
    : []
  const toolsUsed = Array.isArray(value.toolsUsed)
    ? value.toolsUsed.map(parseToolUsage).filter((item): item is EmployeeDailyJournalToolUsage => item !== null)
    : []
  const modelsUsed = Array.isArray(value.modelsUsed)
    ? value.modelsUsed.map(parseModelUsage).filter((item): item is EmployeeDailyJournalModelUsage => item !== null)
    : []
  const consultations = Array.isArray(value.consultations)
    ? value.consultations
        .map(parseConsultation)
        .filter((item): item is EmployeeDailyJournalConsultation => item !== null)
    : []
  const decisions = Array.isArray(value.decisions)
    ? value.decisions.map(parseDecision).filter((item): item is EmployeeDailyJournalDecision => item !== null)
    : []

  return {
    id: value.id,
    version: EMPLOYEE_DAILY_JOURNAL_VERSION,
    employeeId: value.employeeId,
    dateKey: value.dateKey,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    taskTitle: typeof value.taskTitle === 'string' ? value.taskTitle : null,
    taskText: value.taskText,
    workSummary: value.workSummary,
    resultSummary: value.resultSummary,
    toolsUsed,
    modelsUsed,
    consultations,
    decisions,
    reportLinks,
    maxWorkerLoopId: typeof value.maxWorkerLoopId === 'string' ? value.maxWorkerLoopId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    recordedAt: value.recordedAt,
  }
}
