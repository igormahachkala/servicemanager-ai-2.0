/**
 * Owner Morning Report — snapshot builder (AI-COMPANY-100C).
 * Aggregates overnight MAX Worker Loop, Runtime, Cursor Automation, Memory/Knowledge drafts.
 */

import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import {
  buildJournalCompletedTaskLines,
  buildJournalConsultationLines,
  buildJournalDecisionLines,
  buildJournalMemoryAndKnowledge,
  buildJournalModelLines,
  buildJournalOwnerApprovalLines,
  buildJournalReportLines,
  buildJournalToolLines,
  buildJournalWhatMaxDidLines,
  buildRemainingQueueLines,
  computeJournalWorkDurationMs,
  filterJournalEntriesForReportWindow,
  OWNER_MORNING_REPORT_JOURNAL_FALLBACK_NOTE_RU,
  pickJournalNextStep,
} from './ownerMorningReportJournalSections'
import {
  buildBlockedTaskLines,
  buildEmployeeRecommendationLines,
  buildOperatingDayAwareJournalSummary,
  buildUnfinishedTaskLines,
  buildWorkQueueRemainingLines,
  buildOperatingDaySummaryText,
  OWNER_MORNING_REPORT_OPERATING_DAY_IN_PROGRESS_NOTE_RU,
  pickOperatingDayNextStep,
  resolveOperatingDayState,
  resolveOperatingDaySummaryForMorningReport,
} from './ownerMorningReportOperatingDaySections'
import { getTodayWorkdayForEmployee } from '../workday'
import { loadApprovalStore } from '../approval/approvalStorage'
import type { Approval } from '../approval/approval'
import {
  getCursorAutomationOwnerApprovalByLoopId,
  loadCursorAutomationOwnerApprovals,
} from '../cursorAutomation/cursorAutomationOwnerApproval'
import { loadCursorAutomationSubmitRuns } from '../cursorAutomation/cursorAutomationSubmitStorage'
import type { CursorAutomationSubmitRun } from '../cursorAutomation/cursorAutomationSubmitRun'
import { detectExternalExecutorNeed } from '../cursorAutomation/cursorAutomationPlan'
import {
  MAX_WORKER_EMPLOYEE_ID,
  loadMaxWorkerLoopRecords,
  rebuildMaxWorkerLoopSnapshotFromRun,
  type MaxWorkerLoopRecord,
} from '../maxWorkerLoop'
import { loadReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import { listPendingWorkSuggestions } from '../workScheduler/workSchedulerStorage'
import type { WorkSuggestion } from '../workScheduler/workSchedulerTypes'

export type OwnerMorningReportDataSource = 'journal' | 'journal_operating_day' | 'runtime_fallback'

export type OwnerMorningReportOperatingDayState = 'finished' | 'in_progress' | 'not_started'

export type OwnerMorningReportLine = {
  id: string
  headline: string
  detail: string | null
  href: string | null
  badge: string | null
  at: string | null
}

export type OwnerMorningReportNextStep = {
  headline: string
  detail: string
  href: string | null
  priority: 'low' | 'medium' | 'high'
}

export type OwnerMorningReportSnapshot = {
  generatedAt: string
  dateKey: string
  periodLabel: string
  employeeLabel: string
  dataSource: OwnerMorningReportDataSource
  journalFallbackNote: string | null
  operatingDayState: OwnerMorningReportOperatingDayState
  operatingDaySummaryUsed: boolean
  operatingDaySummary: string | null
  operatingDayStatusNote: string | null
  summary: string
  stats: {
    journalEntries: number
    workDurationMinutes: number
    loopsCompleted: number
    reportsCreated: number
    pendingApprovals: number
    cursorTasksPending: number
    memoryDrafts: number
    knowledgeCandidates: number
    remainingQueueCount: number
  }
  whatMaxDid: OwnerMorningReportLine[]
  whatMaxChecked: OwnerMorningReportLine[]
  whatDiscovered: OwnerMorningReportLine[]
  completedTasks: OwnerMorningReportLine[]
  modelsUsed: OwnerMorningReportLine[]
  toolsUsed: OwnerMorningReportLine[]
  consultations: OwnerMorningReportLine[]
  decisions: OwnerMorningReportLine[]
  needsOwnerApproval: OwnerMorningReportLine[]
  reportsCreated: OwnerMorningReportLine[]
  memoryDrafts: OwnerMorningReportLine[]
  knowledgeCandidates: OwnerMorningReportLine[]
  cursorTasks: OwnerMorningReportLine[]
  remainingQueue: OwnerMorningReportLine[]
  employeeRecommendations: OwnerMorningReportLine[]
  unfinishedTasks: OwnerMorningReportLine[]
  blockedTasks: OwnerMorningReportLine[]
  nextStep: OwnerMorningReportNextStep | null
}

function dateKeyFrom(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isSinceMidnight(iso: string, now: Date): boolean {
  const value = new Date(iso)
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  )
}

function isWithinHours(iso: string, hours: number, now: Date): boolean {
  const ms = now.getTime() - new Date(iso).getTime()
  return ms >= 0 && ms <= hours * 60 * 60 * 1000
}

function inReportWindow(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false
  return isSinceMidnight(iso, now) || isWithinHours(iso, 18, now)
}

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

function loopTitle(loop: MaxWorkerLoopRecord): string {
  return loop.input.title?.trim() || loop.input.taskText.slice(0, 72)
}

function loopHref(loop: MaxWorkerLoopRecord): string | null {
  if (loop.runtimeRunId) {
    return `/ops/runtime/live?runId=${encodeURIComponent(loop.runtimeRunId)}`
  }
  return null
}

function reportHref(reportId: string): string {
  return `/ops/reports/${encodeURIComponent(reportId)}`
}

function buildMaxSections(loops: MaxWorkerLoopRecord[], now: Date): {
  did: OwnerMorningReportLine[]
  checked: OwnerMorningReportLine[]
  discovered: OwnerMorningReportLine[]
  completed: OwnerMorningReportLine[]
  memory: OwnerMorningReportLine[]
  knowledge: OwnerMorningReportLine[]
} {
  const did: OwnerMorningReportLine[] = []
  const checked: OwnerMorningReportLine[] = []
  const discovered: OwnerMorningReportLine[] = []
  const completed: OwnerMorningReportLine[] = []
  const memory: OwnerMorningReportLine[] = []
  const knowledge: OwnerMorningReportLine[] = []

  for (const loop of loops) {
    const finishedAt = loop.finishedAt ?? loop.updatedAt
    if (!inReportWindow(finishedAt, now) && !inReportWindow(loop.createdAt, now)) continue

    if (loop.status === 'completed') {
      completed.push(
        line(
          `loop-done-${loop.id}`,
          loopTitle(loop),
          'MAX Worker Loop завершён — Runtime Report создан.',
          loopHref(loop),
          'completed',
          finishedAt,
        ),
      )

      if (loop.runtimeRunId) {
        const snapshot = rebuildMaxWorkerLoopSnapshotFromRun(loop, loop.runtimeRunId)
        if (snapshot) {
          const analysis = snapshot.reasoning.analysis?.trim()
          if (analysis) {
            did.push(
              line(
                `loop-analysis-${loop.id}`,
                `Анализ: ${loopTitle(loop)}`,
                analysis.slice(0, 240),
                loopHref(loop),
                'Ollama',
                finishedAt,
              ),
            )
          }

          for (const finding of snapshot.report.findings.slice(0, 3)) {
            discovered.push(
              line(
                `finding-${loop.id}-${finding.slice(0, 24)}`,
                finding.slice(0, 120),
                loopTitle(loop),
                loopHref(loop),
                'finding',
                finishedAt,
              ),
            )
          }

          for (const risk of snapshot.report.risks.slice(0, 2)) {
            discovered.push(
              line(
                `risk-${loop.id}-${risk.slice(0, 24)}`,
                risk.slice(0, 120),
                null,
                loopHref(loop),
                'risk',
                finishedAt,
              ),
            )
          }

          for (const lesson of snapshot.memoryEvolutionDraft.lessons.slice(0, 4)) {
            memory.push(
              line(
                `mem-${lesson.id}`,
                lesson.title,
                lesson.content.slice(0, 160),
                loopHref(loop),
                lesson.category,
                finishedAt,
              ),
            )
          }

          for (const candidate of snapshot.knowledgeCandidates.slice(0, 4)) {
            knowledge.push(
              line(
                `kc-${candidate.id}`,
                candidate.title,
                candidate.summary.slice(0, 160),
                loopHref(loop),
                candidate.type,
                finishedAt,
              ),
            )
          }
        }
      }
    }

    const toolPhase = loop.phases.find((item) => item.phase === 'tool_need_check')
    if (toolPhase && inReportWindow(toolPhase.completedAt ?? loop.updatedAt, now)) {
      checked.push(
        line(
          `check-tool-${loop.id}`,
          `Tool check: ${loopTitle(loop)}`,
          toolPhase.detail ?? 'Проверка необходимости внешнего исполнителя.',
          loopHref(loop),
          toolPhase.status,
          toolPhase.completedAt ?? null,
        ),
      )
    }

    const verifyPhase = loop.phases.find((item) => item.phase === 'verification')
    if (verifyPhase && verifyPhase.status === 'done' && inReportWindow(verifyPhase.completedAt ?? loop.updatedAt, now)) {
      checked.push(
        line(
          `check-verify-${loop.id}`,
          `MAX Review: ${loopTitle(loop)}`,
          verifyPhase.detail ?? 'Верификация результата.',
          loopHref(loop),
          'review',
          verifyPhase.completedAt ?? null,
        ),
      )
    }

    if (loop.status === 'running' || loop.status === 'queued') {
      did.push(
        line(
          `loop-active-${loop.id}`,
          `В работе: ${loopTitle(loop)}`,
          loop.phases.find((item) => item.status === 'active')?.detail ?? 'MAX Worker Loop выполняется.',
          loopHref(loop),
          loop.status,
          loop.updatedAt,
        ),
      )
    }
  }

  return { did, checked, discovered, completed, memory, knowledge }
}

function buildApprovalLines(
  approvals: Approval[],
  cursorPending: ReturnType<typeof loadCursorAutomationOwnerApprovals>,
  workSuggestions: WorkSuggestion[],
): OwnerMorningReportLine[] {
  const items: OwnerMorningReportLine[] = []

  for (const approval of approvals.filter((item) => item.status === 'pending').slice(0, 8)) {
    items.push(
      line(
        `approval-${approval.id}`,
        approval.title,
        approval.description ?? approval.actionType,
        `/ops/approvals/${encodeURIComponent(approval.id)}`,
        'approval',
        approval.createdAt,
      ),
    )
  }

  for (const gate of cursorPending.filter((item) => item.status === 'pending').slice(0, 6)) {
    items.push(
      line(
        `cursor-approval-${gate.id}`,
        'Cursor Automation — Owner Approval',
        `MAX Worker Loop ${gate.maxWorkerLoopId?.slice(0, 12) ?? '—'} ожидает решения.`,
        gate.maxWorkerLoopId ? `/ops/runtime/live?runId=${encodeURIComponent(gate.runtimeRunId ?? '')}` : '/ops/run-task',
        'cursor',
        gate.createdAt,
      ),
    )
  }

  for (const suggestion of workSuggestions.slice(0, 6)) {
    items.push(
      line(
        `ws-${suggestion.id}`,
        suggestion.title,
        suggestion.rationale,
        suggestion.runtimeRunId
          ? `/ops/runtime/runs/${encodeURIComponent(suggestion.runtimeRunId)}`
          : '/ops/task-results',
        suggestion.priority,
        suggestion.createdAt,
      ),
    )
  }

  return items
}

function buildCursorTaskLines(
  submitRuns: CursorAutomationSubmitRun[],
  loops: MaxWorkerLoopRecord[],
): OwnerMorningReportLine[] {
  const items: OwnerMorningReportLine[] = []

  for (const run of submitRuns.slice(0, 8)) {
    const statusLabel =
      run.status === 'submitted_pending_real_adapter'
        ? 'awaiting adapter'
        : run.status === 'submitted_mock'
          ? 'submitted (mock)'
          : run.status
    items.push(
      line(
        `cursor-submit-${run.runId}`,
        run.handoffPayload.plan.expectedPullRequest.title,
        `Run ${run.runId} · ${statusLabel}`,
        run.runtimeRunId ? `/ops/runtime/live?runId=${encodeURIComponent(run.runtimeRunId)}` : '/ops/run-task',
        statusLabel,
        run.submittedAt,
      ),
    )
  }

  for (const loop of loops) {
    if (loop.status !== 'completed' || !loop.runtimeRunId) continue
    const { required } = detectExternalExecutorNeed(loop.input.taskText)
    if (!required) continue

    const gate = getCursorAutomationOwnerApprovalByLoopId(loop.id)
    const hasSubmit = submitRuns.some((item) => item.maxWorkerLoopId === loop.id)
    if (gate?.status === 'approved' && !hasSubmit) {
      items.push(
        line(
          `cursor-ready-${loop.id}`,
          `Ready for submit: ${loopTitle(loop)}`,
          'Owner одобрил — можно отправить в Cursor Automation.',
          loopHref(loop),
          'ready',
          gate.decidedAt,
        ),
      )
    }
  }

  return items
}

function buildReportLines(reports: Report[], now: Date): OwnerMorningReportLine[] {
  return reports
    .filter(
      (item) =>
        item.employeeId === MAX_WORKER_EMPLOYEE_ID && inReportWindow(item.createdAt, now),
    )
    .slice(0, 10)
    .map((report) =>
      line(
        `report-${report.id}`,
        report.title,
        report.summary.slice(0, 200),
        reportHref(report.id),
        report.type,
        report.createdAt,
      ),
    )
}

function pickNextStep(input: {
  needsApproval: OwnerMorningReportLine[]
  cursorTasks: OwnerMorningReportLine[]
  workSuggestions: WorkSuggestion[]
  loops: MaxWorkerLoopRecord[]
}): OwnerMorningReportNextStep | null {
  const cursorReady = input.cursorTasks.find((item) => item.badge === 'ready')
  if (cursorReady) {
    return {
      headline: cursorReady.headline,
      detail: cursorReady.detail ?? 'Отправить handoff в Cursor Automation pipeline.',
      href: cursorReady.href,
      priority: 'high',
    }
  }

  const cursorPending = input.needsApproval.find((item) => item.badge === 'cursor')
  if (cursorPending) {
    return {
      headline: cursorPending.headline,
      detail: cursorPending.detail ?? 'Примите решение по Cursor Automation handoff.',
      href: cursorPending.href,
      priority: 'high',
    }
  }

  const approval = input.needsApproval[0]
  if (approval) {
    return {
      headline: approval.headline,
      detail: approval.detail ?? 'Требуется решение Owner.',
      href: approval.href,
      priority: 'high',
    }
  }

  const suggestion = input.workSuggestions[0]
  if (suggestion) {
    return {
      headline: suggestion.title,
      detail: suggestion.rationale,
      href: suggestion.runtimeRunId
        ? `/ops/runtime/runs/${encodeURIComponent(suggestion.runtimeRunId)}`
        : '/ops/task-results',
      priority: suggestion.priority,
    }
  }

  const activeLoop = input.loops.find((item) => item.status === 'running' || item.status === 'queued')
  if (activeLoop) {
    return {
      headline: `Следить за MAX: ${loopTitle(activeLoop)}`,
      detail: 'Worker Loop ещё выполняется — проверьте Runtime Live.',
      href: loopHref(activeLoop),
      priority: 'medium',
    }
  }

  return {
    headline: 'Операции стабильны',
    detail: 'Нет срочных решений — можно запустить новую задачу для MAX или просмотреть отчёты.',
    href: '/ops/run-task',
    priority: 'low',
  }
}

function buildRuntimeFallbackSnapshot(now: Date): OwnerMorningReportSnapshot {
  const loops = loadMaxWorkerLoopRecords()
  const reports = loadReports()
  const runtimeRuns = loadRuntimeRuns()
  const cursorApprovals = loadCursorAutomationOwnerApprovals()
  const generalApprovals = loadApprovalStore().approvals
  const workSuggestions = listPendingWorkSuggestions({ employeeId: MAX_WORKER_EMPLOYEE_ID, limit: 12 })

  const maxSections = buildMaxSections(loops, now)
  const runtimeApprovals = buildApprovalLines(generalApprovals, cursorApprovals, workSuggestions)
  const cursorTasks = buildCursorTaskLines(
    loadCursorAutomationSubmitRuns().filter(
      (item) =>
        item.status === 'submitted_mock' ||
        item.status === 'submitted_pending_real_adapter' ||
        item.status === 'waiting_for_result',
    ),
    loops,
  )
  const reportsCreated = buildReportLines(reports, now)
  const remainingQueue = buildRemainingQueueLines()

  const loopsCompleted = loops.filter(
    (item) => item.status === 'completed' && inReportWindow(item.finishedAt ?? item.updatedAt, now),
  ).length

  const runtimeCompletedTonight = runtimeRuns.filter(
    (item) =>
      item.employeeId === MAX_WORKER_EMPLOYEE_ID &&
      item.status === 'completed' &&
      inReportWindow(item.finishedAt ?? item.startedAt, now),
  ).length

  const summaryParts: string[] = []
  if (loopsCompleted > 0) {
    summaryParts.push(`MAX завершил ${loopsCompleted} цикл(ов) Worker Loop.`)
  }
  if (runtimeCompletedTonight > 0) {
    summaryParts.push(`${runtimeCompletedTonight} runtime run(s) за ночь.`)
  }
  if (runtimeApprovals.length > 0) {
    summaryParts.push(`${runtimeApprovals.length} пункт(ов) ждут Owner.`)
  }
  if (summaryParts.length === 0) {
    summaryParts.push('За отчётный период активность MAX минимальна — можно запустить новую задачу.')
  }

  const nextStep = pickNextStep({
    needsApproval: runtimeApprovals,
    cursorTasks,
    workSuggestions,
    loops,
  })

  return {
    generatedAt: now.toISOString(),
    dateKey: dateKeyFrom(now),
    periodLabel: `Ночная смена · ${dateKeyFrom(now)}`,
    employeeLabel: 'MAX · Digital Employee',
    dataSource: 'runtime_fallback',
    journalFallbackNote: OWNER_MORNING_REPORT_JOURNAL_FALLBACK_NOTE_RU,
    operatingDayState: resolveOperatingDayState(
      resolveOperatingDaySummaryForMorningReport(MAX_WORKER_EMPLOYEE_ID, dateKeyFrom(now)),
      getTodayWorkdayForEmployee(MAX_WORKER_EMPLOYEE_ID),
    ),
    operatingDaySummaryUsed: false,
    operatingDaySummary: null,
    operatingDayStatusNote: null,
    summary: summaryParts.join(' '),
    stats: {
      journalEntries: 0,
      workDurationMinutes: 0,
      loopsCompleted,
      reportsCreated: reportsCreated.length,
      pendingApprovals: runtimeApprovals.length,
      cursorTasksPending: cursorTasks.length,
      memoryDrafts: maxSections.memory.length,
      knowledgeCandidates: maxSections.knowledge.length,
      remainingQueueCount: remainingQueue.length,
    },
    whatMaxDid: maxSections.did,
    whatMaxChecked: maxSections.checked,
    whatDiscovered: maxSections.discovered,
    completedTasks: maxSections.completed,
    modelsUsed: [],
    toolsUsed: maxSections.checked,
    consultations: [],
    decisions: maxSections.discovered,
    needsOwnerApproval: runtimeApprovals,
    reportsCreated,
    memoryDrafts: maxSections.memory,
    knowledgeCandidates: maxSections.knowledge,
    cursorTasks,
    remainingQueue,
    employeeRecommendations: [],
    unfinishedTasks: remainingQueue.filter((item) => item.badge !== 'blocked'),
    blockedTasks: remainingQueue.filter((item) => item.badge === 'blocked'),
    nextStep,
  }
}

function buildJournalPrimarySnapshot(now: Date, journalEntries: ReturnType<typeof filterJournalEntriesForReportWindow>): OwnerMorningReportSnapshot {
  const dateKey = dateKeyFrom(now)
  const operatingDaySummary = resolveOperatingDaySummaryForMorningReport(MAX_WORKER_EMPLOYEE_ID, dateKey)
  const workday = getTodayWorkdayForEmployee(MAX_WORKER_EMPLOYEE_ID)
  const operatingDayState = resolveOperatingDayState(operatingDaySummary, workday)
  const operatingDaySummaryUsed = operatingDaySummary !== null
  const operatingDayStatusNote =
    !operatingDaySummaryUsed && operatingDayState !== 'finished'
      ? OWNER_MORNING_REPORT_OPERATING_DAY_IN_PROGRESS_NOTE_RU
      : null

  const cursorApprovals = loadCursorAutomationOwnerApprovals()
  const generalApprovals = loadApprovalStore().approvals
  const workSuggestions = listPendingWorkSuggestions({ employeeId: MAX_WORKER_EMPLOYEE_ID, limit: 12 })
  const loops = loadMaxWorkerLoopRecords()

  const runtimeApprovals = buildApprovalLines(generalApprovals, cursorApprovals, workSuggestions)
  const journalApprovals = buildJournalOwnerApprovalLines(journalEntries)
  const needsOwnerApproval = [...journalApprovals, ...runtimeApprovals]

  const cursorTasks = buildCursorTaskLines(
    loadCursorAutomationSubmitRuns().filter(
      (item) =>
        item.status === 'submitted_mock' ||
        item.status === 'submitted_pending_real_adapter' ||
        item.status === 'waiting_for_result',
    ),
    loops,
  )

  const remainingQueue = buildWorkQueueRemainingLines()
  const unfinishedTasks = buildUnfinishedTaskLines(operatingDaySummary, remainingQueue)
  const blockedTasks = buildBlockedTaskLines(operatingDaySummary, remainingQueue)
  const employeeRecommendations = operatingDaySummary
    ? buildEmployeeRecommendationLines(operatingDaySummary)
    : []

  const workDurationMs = computeJournalWorkDurationMs(journalEntries)
  const workDurationMinutes = Math.round(workDurationMs / 60000)
  const { memory, knowledge } = buildJournalMemoryAndKnowledge(journalEntries)

  const modelsUsed = buildJournalModelLines(journalEntries)
  const toolsUsed = buildJournalToolLines(journalEntries)
  const consultations = buildJournalConsultationLines(journalEntries)
  const decisions = buildJournalDecisionLines(journalEntries)
  const reportsCreated = buildJournalReportLines(journalEntries)

  const journalNextStep = pickJournalNextStep({
    remainingQueue: unfinishedTasks.length > 0 ? unfinishedTasks : remainingQueue,
    needsOwnerApproval,
    cursorTasks,
    entries: journalEntries,
  })

  const nextStep = operatingDaySummary
    ? pickOperatingDayNextStep(operatingDaySummary, unfinishedTasks, journalNextStep)
    : journalNextStep

  return {
    generatedAt: now.toISOString(),
    dateKey,
    periodLabel: `Ночная смена · ${dateKey}`,
    employeeLabel: 'MAX · Digital Employee',
    dataSource: operatingDaySummaryUsed ? 'journal_operating_day' : 'journal',
    journalFallbackNote: null,
    operatingDayState,
    operatingDaySummaryUsed,
    operatingDaySummary: operatingDaySummaryUsed && operatingDaySummary
      ? buildOperatingDaySummaryText(operatingDaySummary)
      : null,
    operatingDayStatusNote,
    summary: buildOperatingDayAwareJournalSummary(
      journalEntries.length,
      workDurationMinutes,
      needsOwnerApproval.length,
      operatingDaySummary,
      unfinishedTasks.length,
      blockedTasks.length,
    ),
    stats: {
      journalEntries: journalEntries.length,
      workDurationMinutes,
      loopsCompleted: journalEntries.filter((item) => item.maxWorkerLoopId).length,
      reportsCreated: reportsCreated.length,
      pendingApprovals: needsOwnerApproval.length,
      cursorTasksPending: cursorTasks.length,
      memoryDrafts: memory.length,
      knowledgeCandidates: knowledge.length,
      remainingQueueCount: unfinishedTasks.length + blockedTasks.length,
    },
    whatMaxDid: buildJournalWhatMaxDidLines(journalEntries),
    whatMaxChecked: toolsUsed,
    whatDiscovered: decisions,
    completedTasks: buildJournalCompletedTaskLines(journalEntries),
    modelsUsed,
    toolsUsed,
    consultations,
    decisions,
    needsOwnerApproval,
    reportsCreated,
    memoryDrafts: memory,
    knowledgeCandidates: knowledge,
    cursorTasks,
    remainingQueue,
    employeeRecommendations,
    unfinishedTasks,
    blockedTasks,
    nextStep,
  }
}

export function buildOwnerMorningReportSnapshot(now: Date = new Date()): OwnerMorningReportSnapshot {
  const allJournalEntries = listEmployeeDailyJournalEntries({ employeeId: MAX_WORKER_EMPLOYEE_ID })
  const journalEntries = filterJournalEntriesForReportWindow(allJournalEntries, now, inReportWindow)

  if (journalEntries.length > 0) {
    return buildJournalPrimarySnapshot(now, journalEntries)
  }

  return buildRuntimeFallbackSnapshot(now)
}
