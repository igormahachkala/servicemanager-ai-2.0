import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT, loadEmployeeWorkItems } from '../../domain/employeeWorkQueue'
import { buildFirstEmployeeFlowStatus } from '../../domain/firstEmployeeFlow'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import {
  buildOwnerHomeSnapshot,
  type OwnerHomeCompletedTask,
  type OwnerHomeDecisionItem,
  type OwnerHomeSnapshot,
} from '../../domain/ownerHome'
import { loadEmployeeOperatingDaySummaries } from '../../domain/operatingDaySummary'
import { CURSOR_AUTOMATION_SYNC_EVENT } from '../../domain/cursorAutomation/cursorAutomationStorage'
import { CHANGE_EVENT as WORKDAY_CHANGE_EVENT } from '../../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { useI18n } from '../../i18n'

const APPROVAL_SYNC_EVENT = 'ai-company-approval-sync'
const MAX_ID = encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)

export type MobileNextActionKind =
  | 'decision_required'
  | 'view_results'
  | 'continue_max'
  | 'launch_first'

export type MobileNextAction = {
  kind: MobileNextActionKind
  href: string
}

export type MobileQuickAction = {
  id: string
  label: string
  href: string
}

export type MobileOwnerHomeViewModel = {
  snapshot: OwnerHomeSnapshot
  nextAction: MobileNextAction
  quickActions: MobileQuickAction[]
  employeeResults: OwnerHomeCompletedTask[]
  decisionItems: OwnerHomeDecisionItem[]
  isEmpty: boolean
  refresh: () => void
}

function hasPendingApprovals(items: OwnerHomeDecisionItem[]): boolean {
  return items.some(
    (item) => item.kind === 'approval' || item.id.startsWith('cursor-approval-'),
  )
}

function hasMaxQueueWork(): boolean {
  return loadEmployeeWorkItems().some(
    (item) =>
      item.employeeId === MAX_WORKER_EMPLOYEE_ID &&
      (item.status === 'in_progress' ||
        item.status === 'pending' ||
        item.status === 'scheduled'),
  )
}

function hasOperatingDaySummaryToday(dateKey: string): boolean {
  return loadEmployeeOperatingDaySummaries().some(
    (item) =>
      item.employeeId === MAX_WORKER_EMPLOYEE_ID &&
      item.dateKey === dateKey,
  )
}

function resolveNextAction(
  snapshot: OwnerHomeSnapshot,
  hasPriorActivity: boolean,
): MobileNextAction {
  if (hasPendingApprovals(snapshot.decisionItems)) {
    const first = snapshot.decisionItems.find(
      (item) => item.kind === 'approval' || item.id.startsWith('cursor-approval-'),
    )
    return {
      kind: 'decision_required',
      href: first?.href ?? '/mobile/decisions',
    }
  }

  if (
    snapshot.completedTasks.length > 0 ||
    hasOperatingDaySummaryToday(snapshot.dateKey)
  ) {
    const withReport = snapshot.completedTasks.find((item) => item.reportHref)
    return {
      kind: 'view_results',
      href: withReport?.reportHref ?? '#employee-results',
    }
  }

  if (hasMaxQueueWork()) {
    return {
      kind: 'continue_max',
      href: `/ops/employees/${MAX_ID}/workspace`,
    }
  }

  if (!hasPriorActivity) {
    return {
      kind: 'launch_first',
      href: `/mobile/tasks/new?employee=${MAX_ID}`,
    }
  }

  return {
    kind: 'launch_first',
    href: `/mobile/tasks/new?employee=${MAX_ID}`,
  }
}

function buildQuickActions(labels: {
  assignMax: string
  maxToday: string
  morningReport: string
  decisions: string
}): MobileQuickAction[] {
  return [
    {
      id: 'assign-max',
      label: labels.assignMax,
      href: `/mobile/tasks/new?employee=${MAX_ID}`,
    },
    {
      id: 'max-today',
      label: labels.maxToday,
      href: `/ops/employees/${MAX_ID}/today`,
    },
    {
      id: 'morning-report',
      label: labels.morningReport,
      href: '/mobile/reports',
    },
    {
      id: 'decisions',
      label: labels.decisions,
      href: '/mobile/decisions',
    },
  ]
}

export function useMobileOwnerHome(): MobileOwnerHomeViewModel {
  const { t } = useI18n()
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    window.addEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
    window.addEventListener(WORKDAY_CHANGE_EVENT, onChange)
    window.addEventListener(APPROVAL_SYNC_EVENT, onChange)
    window.addEventListener('ai-company-presence-sync', onChange)
    window.addEventListener('ai-company-runtime-sync', onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
      window.removeEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
      window.removeEventListener(WORKDAY_CHANGE_EVENT, onChange)
      window.removeEventListener(APPROVAL_SYNC_EVENT, onChange)
      window.removeEventListener('ai-company-presence-sync', onChange)
      window.removeEventListener('ai-company-runtime-sync', onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (
        event.key.includes('work-queue') ||
        event.key.includes('journal') ||
        event.key.includes('approvals') ||
        event.key.includes('presence') ||
        event.key.includes('runtime') ||
        event.key.includes('cursor-automation') ||
        event.key.includes('workday') ||
        event.key.includes('operating-day')
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return useMemo(() => {
    void tick
    const snapshot = buildOwnerHomeSnapshot()
    const firstEmployee = buildFirstEmployeeFlowStatus()
    const nextAction = resolveNextAction(snapshot, firstEmployee.hasPriorActivity)
    const employeeResults = snapshot.completedTasks.slice(0, 5)
    const decisionItems = snapshot.decisionItems.slice(0, 8)
    const isEmpty =
      !firstEmployee.hasPriorActivity &&
      employeeResults.length === 0 &&
      decisionItems.length === 0 &&
      snapshot.companyStatus.tasksInProgress === 0 &&
      !snapshot.companyStatus.isOperating

    return {
      snapshot,
      nextAction,
      quickActions: buildQuickActions(t.mobile.ownerHome.quickActions),
      employeeResults,
      decisionItems,
      isEmpty,
      refresh,
    }
  }, [refresh, t, tick])
}
