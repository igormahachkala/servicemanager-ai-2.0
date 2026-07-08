/**
 * Employee Operating Day Summary — builder (AI-COMPANY-104C).
 * Aggregates Daily Journal, Work Queue, Worker Loop, Decision Plan, Consult Peer, Runtime Reports.
 */

import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { listEmployeeWorkQueue } from '../employeeWorkQueue'
import { loadMaxWorkerLoopRecords, rebuildMaxWorkerLoopSnapshotFromRun } from '../maxWorkerLoop'
import {
  buildJournalMemoryAndKnowledge,
  computeJournalWorkDurationMs,
} from '../morningReport/ownerMorningReportJournalSections'
import type { EmployeeWorkday } from '../workday/workday'
import { getTodayWorkdayForEmployee } from '../workday/workdayStorage'
import {
  createEmployeeOperatingDaySummaryId,
  OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE,
  type BuildEmployeeOperatingDaySummaryInput,
  type EmployeeOperatingDaySummary,
  type OperatingDaySummaryConsultation,
  type OperatingDaySummaryDecision,
  type OperatingDaySummaryDifficulty,
  type OperatingDaySummaryKnowledgeCandidate,
  type OperatingDaySummaryMemoryDraft,
  type OperatingDaySummaryModelUsage,
  type OperatingDaySummaryRemainingItem,
  type OperatingDaySummaryReport,
  type OperatingDaySummaryTaskCompleted,
  type OperatingDaySummaryToolUsage,
} from './operatingDaySummary'

function isOnDateKey(iso: string | null | undefined, dateKey: string): boolean {
  if (!iso) return false
  return iso.slice(0, 10) === dateKey
}

function dedupeDecisions(items: OperatingDaySummaryDecision[]): OperatingDaySummaryDecision[] {
  const seen = new Set<string>()
  const result: OperatingDaySummaryDecision[] = []
  for (const item of items) {
    const key = `${item.source ?? 'none'}:${item.summary}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function aggregateTools(
  entries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): OperatingDaySummaryToolUsage[] {
  const map = new Map<string, OperatingDaySummaryToolUsage>()
  for (const entry of entries) {
    for (const tool of entry.toolsUsed) {
      const existing = map.get(tool.toolId)
      if (existing) {
        existing.usageCount += 1
        if (!existing.reason && tool.reason) existing.reason = tool.reason
      } else {
        map.set(tool.toolId, {
          toolId: tool.toolId,
          label: tool.label,
          usageCount: 1,
          reason: tool.reason,
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.usageCount - a.usageCount)
}

function aggregateModels(
  entries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): OperatingDaySummaryModelUsage[] {
  const map = new Map<string, OperatingDaySummaryModelUsage>()
  for (const entry of entries) {
    for (const model of entry.modelsUsed) {
      const key = `${model.modelId}:${model.role}`
      const existing = map.get(key)
      if (existing) {
        existing.usageCount += 1
      } else {
        map.set(key, {
          modelId: model.modelId,
          label: model.label,
          role: model.role,
          usageCount: 1,
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.usageCount - a.usageCount)
}

function buildConsultations(
  entries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): OperatingDaySummaryConsultation[] {
  const map = new Map<string, OperatingDaySummaryConsultation>()
  for (const entry of entries) {
    for (const consult of entry.consultations) {
      if (!map.has(consult.peerEmployeeId)) {
        map.set(consult.peerEmployeeId, {
          peerEmployeeId: consult.peerEmployeeId,
          peerDisplayName: consult.peerDisplayName,
          reason: consult.reason,
          outcome: consult.outcome,
        })
      }
    }
  }
  return [...map.values()]
}

function buildReportsCreated(
  entries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): OperatingDaySummaryReport[] {
  const map = new Map<string, OperatingDaySummaryReport>()
  for (const entry of entries) {
    for (const link of entry.reportLinks) {
      if (map.has(link.reportId)) continue
      map.set(link.reportId, {
        reportId: link.reportId,
        title: link.title,
        href: link.href,
        summary: link.summary,
      })
    }
  }
  return [...map.values()]
}

function buildMemoryAndKnowledgeDrafts(
  entries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): {
  memoryDrafts: OperatingDaySummaryMemoryDraft[]
  knowledgeCandidates: OperatingDaySummaryKnowledgeCandidate[]
} {
  const { memory, knowledge } = buildJournalMemoryAndKnowledge(entries)
  return {
    memoryDrafts: memory.map((item) => ({
      id: item.id,
      title: item.headline,
      preview: item.detail ?? '',
      category: item.badge,
    })),
    knowledgeCandidates: knowledge.map((item) => ({
      id: item.id,
      title: item.headline,
      summary: item.detail ?? '',
      type: item.badge,
    })),
  }
}

function buildTasksCompleted(
  journalEntries: ReturnType<typeof listEmployeeDailyJournalEntries>,
  queueCompleted: ReturnType<typeof listEmployeeWorkQueue>['items'],
): OperatingDaySummaryTaskCompleted[] {
  const tasks: OperatingDaySummaryTaskCompleted[] = journalEntries.map((entry) => ({
    journalEntryId: entry.id,
    workItemId: entry.taskId,
    maxWorkerLoopId: entry.maxWorkerLoopId,
    runtimeRunId: entry.runtimeRunId,
    reportId: entry.reportLinks[0]?.reportId ?? null,
    title: entry.taskTitle?.trim() || entry.taskText.slice(0, 120),
    finishedAt: entry.finishedAt,
  }))

  for (const item of queueCompleted) {
    if (tasks.some((task) => task.workItemId === item.id)) continue
    tasks.push({
      journalEntryId: null,
      workItemId: item.id,
      maxWorkerLoopId: item.workerLoopId,
      runtimeRunId: null,
      reportId: null,
      title: item.title,
      finishedAt: item.completedAt ?? item.updatedAt,
    })
  }

  return tasks.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
}

function buildDecisions(
  journalEntries: ReturnType<typeof listEmployeeDailyJournalEntries>,
  loops: ReturnType<typeof loadMaxWorkerLoopRecords>,
): OperatingDaySummaryDecision[] {
  const items: OperatingDaySummaryDecision[] = []

  for (const entry of journalEntries) {
    for (const decision of entry.decisions) {
      items.push({
        summary: decision.summary,
        rationale: decision.rationale,
        source: decision.source ?? 'journal',
      })
    }
  }

  for (const loop of loops) {
    const plan = loop.decisionPlan
    if (!plan) continue
    for (const line of plan.rationale) {
      items.push({ summary: line, rationale: null, source: 'decision_plan' })
    }
    if (plan.ownerApprovalRequired) {
      for (const reason of plan.ownerApprovalReasons) {
        items.push({
          summary: reason,
          rationale: 'Decision Plan: Owner Approval',
          source: 'owner_approval',
        })
      }
    }
    if (plan.peerConsultation.required && plan.peerConsultation.reason) {
      items.push({
        summary: plan.peerConsultation.reason,
        rationale: plan.peerConsultation.peerDisplayName,
        source: 'peer_consult',
      })
    }
  }

  return dedupeDecisions(items)
}

function buildDifficulties(
  loops: ReturnType<typeof loadMaxWorkerLoopRecords>,
  queue: ReturnType<typeof listEmployeeWorkQueue>,
  workday: EmployeeWorkday | null,
): OperatingDaySummaryDifficulty[] {
  const items: OperatingDaySummaryDifficulty[] = []

  for (const loop of loops) {
    if (loop.status === 'failed') {
      items.push({
        id: `loop-failed-${loop.id}`,
        kind: 'worker_loop_failed',
        summary: loop.input.title?.trim() || loop.input.taskText.slice(0, 80),
        detail: loop.errorMessage,
      })
    }

    if (loop.peerConsultation?.status === 'failed') {
      items.push({
        id: `peer-failed-${loop.id}`,
        kind: 'peer_consult',
        summary: `Consult Peer: ${loop.peerConsultation.peerDisplayName ?? loop.peerConsultation.peerEmployeeId ?? 'colleague'}`,
        detail: loop.peerConsultation.skipReason,
      })
    }

    if (
      loop.decisionPlan?.ownerApprovalRequired &&
      loop.status !== 'completed' &&
      loop.status !== 'failed'
    ) {
      items.push({
        id: `approval-pending-${loop.id}`,
        kind: 'owner_approval',
        summary: 'Owner Approval ожидает решения',
        detail: loop.decisionPlan.ownerApprovalReasons.join(' · ') || loop.decisionPlan.cursorAutomationReason,
      })
    }
  }

  for (const item of queue.items) {
    if (item.status !== 'blocked') continue
    items.push({
      id: `queue-blocked-${item.id}`,
      kind: 'queue_blocked',
      summary: item.title,
      detail: item.blockedReason,
    })
  }

  if (workday) {
    for (const agenda of workday.agendaItems) {
      if (agenda.completed) continue
      items.push({
        id: `agenda-${agenda.id}`,
        kind: 'agenda_incomplete',
        summary: agenda.label,
        detail: `Agenda · ${agenda.source}`,
      })
    }
  }

  return items
}

function buildRemainingWork(
  queue: ReturnType<typeof listEmployeeWorkQueue>,
  workday: EmployeeWorkday | null,
): OperatingDaySummaryRemainingItem[] {
  const items: OperatingDaySummaryRemainingItem[] = []

  for (const item of queue.items) {
    if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'skipped') {
      continue
    }
    items.push({
      id: `queue-${item.id}`,
      kind: 'work_queue',
      title: item.title,
      status: item.status,
      detail: item.summary ?? item.blockedReason ?? item.taskText?.slice(0, 160) ?? null,
    })
  }

  if (workday) {
    for (const agenda of workday.agendaItems.filter((item) => !item.completed)) {
      items.push({
        id: agenda.id,
        kind: 'agenda',
        title: agenda.label,
        status: 'pending',
        detail: agenda.source,
      })
    }
  }

  return items.slice(0, 20)
}

function countRemainingQueueItems(queue: ReturnType<typeof listEmployeeWorkQueue>): number {
  return queue.items.filter(
    (item) =>
      item.status !== 'completed' &&
      item.status !== 'cancelled' &&
      item.status !== 'skipped',
  ).length
}

function countBlockedQueueItems(queue: ReturnType<typeof listEmployeeWorkQueue>): number {
  return queue.items.filter((item) => item.status === 'blocked').length
}

function resolveWorkDurationMs(
  journalEntries: ReturnType<typeof listEmployeeDailyJournalEntries>,
  startedAt: string | null,
  finishedAt: string,
): number {
  const journalMs = computeJournalWorkDurationMs(journalEntries)
  if (journalMs > 0) return journalMs
  if (!startedAt) return 0
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return end - start
}

function buildRecommendations(
  journalEntries: ReturnType<typeof listEmployeeDailyJournalEntries>,
  remaining: OperatingDaySummaryRemainingItem[],
  difficulties: OperatingDaySummaryDifficulty[],
): string[] {
  const recommendations: string[] = []

  const blocked = remaining.filter((item) => item.status === 'blocked')
  if (blocked.length > 0) {
    recommendations.push(`Разблокировать ${blocked.length} задач(и) в Work Queue: «${blocked[0]!.title}».`)
  }

  const pending = remaining.filter((item) => item.kind === 'work_queue' && item.status === 'pending')
  if (pending.length > 0) {
    recommendations.push(
      `Начать следующий рабочий день с ${pending.length} pending item(s) — приоритет: «${pending[0]!.title}».`,
    )
  }

  for (const entry of journalEntries.slice(0, 3)) {
    const nextHint = entry.resultSummary.split('\n').find((line) => /next|следующ/i.test(line))
    if (nextHint) recommendations.push(nextHint.trim())
  }

  for (const entry of journalEntries) {
    if (!entry.maxWorkerLoopId || !entry.runtimeRunId) continue
    const loop = loadMaxWorkerLoopRecords().find((item) => item.id === entry.maxWorkerLoopId)
    if (!loop) continue
    const snapshot = rebuildMaxWorkerLoopSnapshotFromRun(loop, entry.runtimeRunId)
    if (!snapshot) continue
    for (const action of snapshot.nextActions.slice(0, 2)) {
      recommendations.push(`${action.label} (${action.priority})`)
    }
    if (snapshot.report.nextStep) {
      recommendations.push(snapshot.report.nextStep)
    }
  }

  if (difficulties.some((item) => item.kind === 'worker_loop_failed')) {
    recommendations.push('Повторить или декомпозировать failed Worker Loop задачи.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Work Queue пуст — запланировать новые задачи Owner на следующий день.')
  }

  const seen = new Set<string>()
  return recommendations
    .filter((line) => {
      if (seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(0, 8)
}

function buildNarrative(summary: {
  dateKey: string
  tasksCompletedCount: number
  tasksFailed: number
  tasksRemainingCount: number
  tasksBlockedCount: number
  workDurationMs: number
}): string {
  const minutes = Math.max(1, Math.round(summary.workDurationMs / 60_000))
  return [
    `Рабочий день ${summary.dateKey}.`,
    `Выполнено: ${summary.tasksCompletedCount}.`,
    summary.tasksFailed > 0 ? `Ошибок: ${summary.tasksFailed}.` : null,
    summary.tasksRemainingCount > 0 ? `Осталось: ${summary.tasksRemainingCount}.` : null,
    summary.tasksBlockedCount > 0 ? `Заблокировано: ${summary.tasksBlockedCount}.` : null,
    `Время работы: ~${minutes} мин.`,
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildEmployeeOperatingDaySummary(
  input: BuildEmployeeOperatingDaySummaryInput,
): EmployeeOperatingDaySummary {
  const now = input.now ?? new Date()
  const { employeeId, dateKey } = input

  const workday = input.workday ?? getTodayWorkdayForEmployee(employeeId)
  const startedAt = input.sessionStartedAt ?? workday?.startedAt ?? null

  const journalEntries = listEmployeeDailyJournalEntries({ employeeId, dateKey })
  const queue = listEmployeeWorkQueue(employeeId, { includeTerminal: true })
  const queueCompletedToday = queue.items.filter(
    (item) => item.status === 'completed' && isOnDateKey(item.completedAt ?? item.updatedAt, dateKey),
  )

  const loops = loadMaxWorkerLoopRecords().filter(
    (loop) =>
      loop.employeeId === employeeId &&
      (isOnDateKey(loop.finishedAt, dateKey) ||
        isOnDateKey(loop.updatedAt, dateKey) ||
        isOnDateKey(loop.createdAt, dateKey)),
  )

  const tasksCompleted = buildTasksCompleted(journalEntries, queueCompletedToday)
  const decisionsMade = buildDecisions(journalEntries, loops)
  const toolsUsed = aggregateTools(journalEntries)
  const modelsUsed = aggregateModels(journalEntries)
  const consultations = buildConsultations(journalEntries)
  const reportsCreated = buildReportsCreated(journalEntries)
  const { memoryDrafts, knowledgeCandidates } = buildMemoryAndKnowledgeDrafts(journalEntries)
  const difficulties = buildDifficulties(loops, queue, workday?.date === dateKey ? workday : null)
  const remainingWork = buildRemainingWork(queue, workday?.date === dateKey ? workday : null)
  const nextDayRecommendations = buildRecommendations(journalEntries, remainingWork, difficulties)

  const tasksRemainingCount = countRemainingQueueItems(queue)
  const tasksBlockedCount = countBlockedQueueItems(queue)

  const consultationCount =
    consultations.length +
    loops.filter((loop) => loop.peerConsultation?.status === 'completed').length

  const decisionPlanIds = [
    ...new Set(
      loops.map((loop) => loop.decisionPlan?.id).filter((id): id is string => typeof id === 'string'),
    ),
  ]

  const finishedAt = input.finishedAt ?? workday?.finishedAt ?? now.toISOString()
  const workDurationMs = resolveWorkDurationMs(journalEntries, startedAt, finishedAt)

  return {
    id: createEmployeeOperatingDaySummaryId(now),
    version: 'v1',
    employeeId,
    dateKey,
    operatingDayId: input.operatingDayId ?? null,
    operatingDaySessionId: input.operatingDaySessionId ?? null,
    workdayId: workday?.id ?? null,
    startedAt,
    finishedAt,
    workDurationMs,
    tasksCompletedCount: tasksCompleted.length,
    tasksRemainingCount,
    tasksBlockedCount,
    tasksCompleted,
    decisionsMade,
    toolsUsed,
    modelsUsed,
    consultations,
    reportsCreated,
    memoryDrafts,
    knowledgeCandidates,
    difficulties,
    remainingWork,
    nextDayRecommendations,
    journalEntryIds: journalEntries.map((entry) => entry.id),
    workerLoopIds: loops.map((loop) => loop.id),
    decisionPlanIds,
    consultationCount,
    morningReportSource: OPERATING_DAY_SUMMARY_MORNING_REPORT_SOURCE,
    morningReportEligible: journalEntries.length > 0 || tasksCompleted.length > 0,
    generatedAt: now.toISOString(),
  }
}

export function buildEmployeeOperatingDaySummaryNarrative(
  summary: EmployeeOperatingDaySummary,
): string {
  return buildNarrative({
    dateKey: summary.dateKey,
    tasksCompletedCount: summary.tasksCompletedCount,
    tasksRemainingCount: summary.tasksRemainingCount,
    tasksBlockedCount: summary.tasksBlockedCount,
    tasksFailed: summary.difficulties.filter((item) => item.kind === 'worker_loop_failed').length,
    workDurationMs: summary.workDurationMs,
  })
}
