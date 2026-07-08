/**
 * Owner Morning Report — sections built from Employee Daily Journal (AI-COMPANY-103D-3).
 */

import type { EmployeeDailyJournalEntry } from '../employeeDailyJournal'
import { listEmployeeWorkQueue } from '../employeeWorkQueue'
import { getMaxWorkerLoopById, MAX_WORKER_EMPLOYEE_ID, rebuildMaxWorkerLoopSnapshotFromRun } from '../maxWorkerLoop'
import type {
  OwnerMorningReportLine,
  OwnerMorningReportNextStep,
} from './ownerMorningReportSnapshot'

export const OWNER_MORNING_REPORT_JOURNAL_FALLBACK_NOTE_RU =
  'Журнал сотрудника пока пуст. Отчёт построен по Runtime-данным.'

export const OWNER_MORNING_REPORT_JOURNAL_FALLBACK_NOTE_EN =
  'Employee journal is empty. Report built from Runtime data.'

function line(
  id: string,
  headline: string,
  detail: string | null = null,
  href: string | null = null,
  badge: string | null = null,
  at: string | null = null,
): OwnerMorningReportLine {
  return { id, headline, detail, href, badge, at }
}

function runtimeHref(entry: EmployeeDailyJournalEntry): string | null {
  if (entry.runtimeRunId) {
    return `/ops/runtime/live?runId=${encodeURIComponent(entry.runtimeRunId)}`
  }
  return null
}

function taskTitle(entry: EmployeeDailyJournalEntry): string {
  return entry.taskTitle?.trim() || entry.taskText.slice(0, 72)
}

export function filterJournalEntriesForReportWindow(
  entries: EmployeeDailyJournalEntry[],
  now: Date,
  inReportWindow: (iso: string | null | undefined, now: Date) => boolean,
): EmployeeDailyJournalEntry[] {
  return entries
    .filter(
      (item) =>
        item.employeeId === MAX_WORKER_EMPLOYEE_ID &&
        inReportWindow(item.finishedAt, now),
    )
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
}

export function computeJournalWorkDurationMs(entries: EmployeeDailyJournalEntry[]): number {
  return entries.reduce((sum, entry) => {
    const start = Date.parse(entry.startedAt)
    const end = Date.parse(entry.finishedAt)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum
    return sum + (end - start)
  }, 0)
}

export function buildJournalWhatMaxDidLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  return entries.map((entry) =>
    line(
      `journal-work-${entry.id}`,
      taskTitle(entry),
      entry.workSummary.slice(0, 280),
      runtimeHref(entry),
      'journal',
      entry.finishedAt,
    ),
  )
}

export function buildJournalCompletedTaskLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  return entries.map((entry) =>
    line(
      `journal-done-${entry.id}`,
      taskTitle(entry),
      entry.resultSummary.slice(0, 240),
      runtimeHref(entry),
      'completed',
      entry.finishedAt,
    ),
  )
}

export function buildJournalModelLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const seen = new Set<string>()
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const model of entry.modelsUsed) {
      const key = `${model.modelId}:${model.role}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(
        line(
          `journal-model-${key}`,
          model.label,
          [model.ollamaTag, model.reason].filter(Boolean).join(' · ') || model.role,
          runtimeHref(entry),
          model.role,
          entry.finishedAt,
        ),
      )
    }
  }

  return items.slice(0, 12)
}

export function buildJournalToolLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const seen = new Set<string>()
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const tool of entry.toolsUsed) {
      if (seen.has(tool.toolId)) continue
      seen.add(tool.toolId)
      items.push(
        line(
          `journal-tool-${tool.toolId}`,
          tool.label,
          tool.reason,
          runtimeHref(entry),
          tool.toolId,
          entry.finishedAt,
        ),
      )
    }
  }

  return items.slice(0, 12)
}

export function buildJournalConsultationLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const consult of entry.consultations) {
      items.push(
        line(
          `journal-consult-${entry.id}-${consult.peerEmployeeId}`,
          consult.peerDisplayName ?? consult.peerEmployeeId,
          [consult.reason, consult.outcome].filter(Boolean).join(' → ') || null,
          runtimeHref(entry),
          'consult',
          entry.finishedAt,
        ),
      )
    }
  }

  return items.slice(0, 10)
}

export function buildJournalDecisionLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const decision of entry.decisions.filter((item) => item.source !== 'owner_approval')) {
      items.push(
        line(
          `journal-decision-${entry.id}-${decision.summary.slice(0, 24)}`,
          decision.summary.slice(0, 120),
          decision.rationale,
          runtimeHref(entry),
          decision.source ?? 'decision',
          entry.finishedAt,
        ),
      )
    }
  }

  return items.slice(0, 16)
}

export function buildJournalOwnerApprovalLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const decision of entry.decisions.filter((item) => item.source === 'owner_approval')) {
      items.push(
        line(
          `journal-approval-${entry.id}-${decision.summary.slice(0, 24)}`,
          decision.summary.slice(0, 120),
          decision.rationale ?? taskTitle(entry),
          runtimeHref(entry),
          'owner_approval',
          entry.finishedAt,
        ),
      )
    }
  }

  return items
}

export function buildJournalReportLines(entries: EmployeeDailyJournalEntry[]): OwnerMorningReportLine[] {
  const seen = new Set<string>()
  const items: OwnerMorningReportLine[] = []

  for (const entry of entries) {
    for (const link of entry.reportLinks) {
      if (seen.has(link.reportId)) continue
      seen.add(link.reportId)
      items.push(
        line(
          `journal-report-${link.reportId}`,
          link.title,
          link.summary?.slice(0, 200) ?? null,
          link.href,
          'report',
          entry.finishedAt,
        ),
      )
    }
  }

  return items
}

export function buildRemainingQueueLines(): OwnerMorningReportLine[] {
  const queue = listEmployeeWorkQueue(MAX_WORKER_EMPLOYEE_ID)
  return queue.items
    .filter((item) => item.status === 'pending' || item.status === 'scheduled' || item.status === 'blocked')
    .slice(0, 10)
    .map((item) =>
      line(
        `queue-${item.id}`,
        item.title,
        item.summary ?? item.taskText?.slice(0, 160) ?? item.blockedReason,
        item.workerLoopId
          ? `/ops/runtime/live?runId=${encodeURIComponent(item.workerLoopId)}`
          : '/ops/run-task?employee=ag-max',
        item.status,
        item.scheduledAt ?? item.updatedAt,
      ),
    )
}

export function buildJournalMemoryAndKnowledge(entries: EmployeeDailyJournalEntry[]): {
  memory: OwnerMorningReportLine[]
  knowledge: OwnerMorningReportLine[]
} {
  const memory: OwnerMorningReportLine[] = []
  const knowledge: OwnerMorningReportLine[] = []
  const seenLoops = new Set<string>()

  for (const entry of entries) {
    if (!entry.maxWorkerLoopId || !entry.runtimeRunId || seenLoops.has(entry.maxWorkerLoopId)) continue
    seenLoops.add(entry.maxWorkerLoopId)

    const loop = getMaxWorkerLoopById(entry.maxWorkerLoopId)
    if (!loop) continue

    const snapshot = rebuildMaxWorkerLoopSnapshotFromRun(loop, entry.runtimeRunId)
    if (!snapshot) continue

    for (const lesson of snapshot.memoryEvolutionDraft.lessons.slice(0, 4)) {
      memory.push(
        line(
          `journal-mem-${lesson.id}`,
          lesson.title,
          lesson.content.slice(0, 160),
          runtimeHref(entry),
          lesson.category,
          entry.finishedAt,
        ),
      )
    }

    for (const candidate of snapshot.knowledgeCandidates.slice(0, 4)) {
      knowledge.push(
        line(
          `journal-kc-${candidate.id}`,
          candidate.title,
          candidate.summary.slice(0, 160),
          runtimeHref(entry),
          candidate.type,
          entry.finishedAt,
        ),
      )
    }
  }

  return { memory, knowledge }
}

export function pickJournalNextStep(input: {
  remainingQueue: OwnerMorningReportLine[]
  needsOwnerApproval: OwnerMorningReportLine[]
  cursorTasks: OwnerMorningReportLine[]
  entries: EmployeeDailyJournalEntry[]
}): OwnerMorningReportNextStep | null {
  const queueNext = input.remainingQueue[0]
  if (queueNext) {
    return {
      headline: `Следующая в очереди: ${queueNext.headline}`,
      detail: queueNext.detail ?? 'Employee Work Queue — задача ждёт запуска Scheduler / Run Task.',
      href: queueNext.href,
      priority: 'high',
    }
  }

  const cursorReady = input.cursorTasks.find((item) => item.badge === 'ready')
  if (cursorReady) {
    return {
      headline: cursorReady.headline,
      detail: cursorReady.detail ?? 'Отправить handoff в Cursor Automation pipeline.',
      href: cursorReady.href,
      priority: 'high',
    }
  }

  const approval = input.needsOwnerApproval[0]
  if (approval) {
    return {
      headline: approval.headline,
      detail: approval.detail ?? 'Требуется решение Owner.',
      href: approval.href,
      priority: 'high',
    }
  }

  const lastEntry = input.entries[0]
  if (lastEntry?.resultSummary) {
    return {
      headline: `Продолжить после: ${taskTitle(lastEntry)}`,
      detail: lastEntry.resultSummary.slice(0, 240),
      href: runtimeHref(lastEntry),
      priority: 'medium',
    }
  }

  return {
    headline: 'Очередь пуста — можно добавить задачи',
    detail: 'Journal зафиксировал завершённую работу MAX. Запустите новую задачу или наполните Work Queue.',
    href: '/ops/run-task?employee=ag-max',
    priority: 'low',
  }
}

export function buildJournalSummary(
  entries: EmployeeDailyJournalEntry[],
  workDurationMinutes: number,
  pendingApprovals: number,
  remainingQueueCount: number,
): string {
  const parts: string[] = []
  parts.push(`MAX завершил ${entries.length} задач(у/и) — данные из Daily Journal.`)
  if (workDurationMinutes > 0) {
    parts.push(`Суммарное время работы: ${workDurationMinutes} мин.`)
  }
  if (pendingApprovals > 0) {
    parts.push(`${pendingApprovals} пункт(ов) ждут Owner.`)
  }
  if (remainingQueueCount > 0) {
    parts.push(`В очереди осталось ${remainingQueueCount} задач(и).`)
  }
  return parts.join(' ')
}
