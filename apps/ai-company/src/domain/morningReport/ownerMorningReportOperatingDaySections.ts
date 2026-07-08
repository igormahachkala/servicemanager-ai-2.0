/**
 * Owner Morning Report — Operating Day Summary bridge (AI-COMPANY-104E).
 * Journal = facts; Operating Day Summary = outcomes; Work Queue = remaining work.
 */

import { listEmployeeWorkQueue } from '../employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import {
  getEmployeeOperatingDaySummaryByEmployeeAndDate,
  type EmployeeOperatingDaySummary,
} from '../operatingDaySummary'
import { buildEmployeeOperatingDaySummaryNarrative } from '../operatingDaySummary/operatingDaySummaryEngine'
import { getTodayWorkdayForEmployee } from '../workday'
import type {
  OwnerMorningReportLine,
  OwnerMorningReportNextStep,
  OwnerMorningReportOperatingDayState,
} from './ownerMorningReportSnapshot'

export const OWNER_MORNING_REPORT_OPERATING_DAY_IN_PROGRESS_NOTE_RU =
  'Рабочий день ещё не завершён. Итог построен по текущему журналу.'

export const OWNER_MORNING_REPORT_OPERATING_DAY_IN_PROGRESS_NOTE_EN =
  'The workday is not finished yet. Summary built from the current journal.'

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

function queueItemHref(workItemId: string | null): string | null {
  if (!workItemId) return `/ops/run-task?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`
  return `/ops/run-task?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}&workItem=${encodeURIComponent(workItemId)}`
}

export function resolveOperatingDaySummaryForMorningReport(
  employeeId: string,
  dateKey: string,
): EmployeeOperatingDaySummary | null {
  return getEmployeeOperatingDaySummaryByEmployeeAndDate(employeeId, dateKey)
}

export function resolveOperatingDayState(
  summary: EmployeeOperatingDaySummary | null,
  workday: ReturnType<typeof getTodayWorkdayForEmployee>,
): OwnerMorningReportOperatingDayState {
  if (summary) return 'finished'
  if (!workday?.startedAt) return 'not_started'
  if (workday.state === 'finished' || workday.finishedAt) return 'finished'
  return 'in_progress'
}

export function buildOperatingDaySummaryText(summary: EmployeeOperatingDaySummary): string {
  const narrative = buildEmployeeOperatingDaySummaryNarrative(summary)
  const extras: string[] = []
  if (summary.consultationCount > 0) {
    extras.push(`${summary.consultationCount} консультаций`)
  }
  if (summary.decisionsMade.length > 0) {
    extras.push(`${summary.decisionsMade.length} решений`)
  }
  if (extras.length === 0) return narrative
  return `${narrative} · ${extras.join(', ')}.`
}

export function buildEmployeeRecommendationLines(
  summary: EmployeeOperatingDaySummary,
): OwnerMorningReportLine[] {
  return summary.nextDayRecommendations.map((text, index) =>
    line(`op-day-rec-${summary.id}-${index}`, text, null, `/ops/employees/${encodeURIComponent(summary.employeeId)}/today`, 'recommendation', summary.finishedAt),
  )
}

function mapRemainingItem(
  item: EmployeeOperatingDaySummary['remainingWork'][number],
  summary: EmployeeOperatingDaySummary,
): OwnerMorningReportLine {
  const workItemId = item.kind === 'work_queue' ? item.id.replace(/^queue-/, '') : null
  return line(
    `op-day-remaining-${item.id}`,
    item.title,
    item.detail,
    item.kind === 'work_queue' ? queueItemHref(workItemId) : `/ops/employees/${encodeURIComponent(summary.employeeId)}/today`,
    item.status,
    summary.finishedAt,
  )
}

export function buildUnfinishedTaskLines(
  summary: EmployeeOperatingDaySummary | null,
  fallbackQueue: OwnerMorningReportLine[],
): OwnerMorningReportLine[] {
  if (summary) {
    return summary.remainingWork
      .filter((item) => item.status !== 'blocked')
      .map((item) => mapRemainingItem(item, summary))
  }

  return fallbackQueue.filter((item) => item.badge !== 'blocked')
}

export function buildBlockedTaskLines(
  summary: EmployeeOperatingDaySummary | null,
  fallbackQueue: OwnerMorningReportLine[],
): OwnerMorningReportLine[] {
  if (summary) {
    const fromRemaining = summary.remainingWork
      .filter((item) => item.status === 'blocked')
      .map((item) => mapRemainingItem(item, summary))

    const fromDifficulties = summary.difficulties
      .filter((item) => item.kind === 'queue_blocked')
      .map((item) =>
        line(
          `op-day-blocked-${item.id}`,
          item.summary,
          item.detail,
          `/ops/employees/${encodeURIComponent(summary.employeeId)}/today`,
          'blocked',
          summary.finishedAt,
        ),
      )

    const seen = new Set<string>()
    return [...fromRemaining, ...fromDifficulties].filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }

  return fallbackQueue.filter((item) => item.badge === 'blocked')
}

export function buildWorkQueueRemainingLines(employeeId: string = MAX_WORKER_EMPLOYEE_ID): OwnerMorningReportLine[] {
  const queue = listEmployeeWorkQueue(employeeId)
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
          : `/ops/run-task?employee=${encodeURIComponent(employeeId)}`,
        item.status,
        item.scheduledAt ?? item.updatedAt,
      ),
    )
}

export function pickOperatingDayNextStep(
  summary: EmployeeOperatingDaySummary,
  unfinishedTasks: OwnerMorningReportLine[],
  fallback: OwnerMorningReportNextStep | null,
): OwnerMorningReportNextStep {
  const recommendation = summary.nextDayRecommendations[0]
  if (recommendation) {
    return {
      headline: 'Рекомендация сотрудника',
      detail: recommendation,
      href: unfinishedTasks[0]?.href ?? `/ops/employees/${encodeURIComponent(summary.employeeId)}/today`,
      priority: 'high',
    }
  }

  const nextTask = unfinishedTasks[0]
  if (nextTask) {
    return {
      headline: `Следующий шаг: ${nextTask.headline}`,
      detail: nextTask.detail ?? 'Незавершённая задача из Operating Day Summary / Work Queue.',
      href: nextTask.href,
      priority: nextTask.badge === 'blocked' ? 'high' : 'medium',
    }
  }

  if (fallback) return fallback

  return {
    headline: 'Operating Day завершён',
    detail: 'Очередь пуста — можно планировать новый рабочий день.',
    href: `/ops/employees/${encodeURIComponent(summary.employeeId)}/today`,
    priority: 'low',
  }
}

export function buildOperatingDayAwareJournalSummary(
  journalEntryCount: number,
  workDurationMinutes: number,
  pendingApprovals: number,
  summary: EmployeeOperatingDaySummary | null,
  unfinishedCount: number,
  blockedCount: number,
): string {
  if (summary) {
    return buildOperatingDaySummaryText(summary)
  }

  const parts: string[] = []
  parts.push(`MAX завершил ${journalEntryCount} задач(у/и) — данные из Daily Journal.`)
  if (workDurationMinutes > 0) {
    parts.push(`Суммарное время работы: ${workDurationMinutes} мин.`)
  }
  if (pendingApprovals > 0) {
    parts.push(`${pendingApprovals} пункт(ов) ждут Owner.`)
  }
  if (unfinishedCount > 0) {
    parts.push(`Незавершённых задач: ${unfinishedCount}.`)
  }
  if (blockedCount > 0) {
    parts.push(`Заблокировано: ${blockedCount}.`)
  }
  return parts.join(' ')
}
