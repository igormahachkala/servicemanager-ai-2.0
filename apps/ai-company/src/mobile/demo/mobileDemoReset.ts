/**
 * Demo reset — clears runtime Owner-loop data from localStorage (AI-COMPANY-108B).
 * Preserves company config, runtime profiles/models, employee brains, theme.
 */

import { markMobileDemoReset, MOBILE_DEMO_SYNC_EVENT } from './mobileDemoStorage'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../../domain/employeeOperatingDay/employeeOperatingDayEngine'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../../domain/operatingDaySummary/operatingDaySummaryStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { DECISION_PLAN_SYNC_EVENT } from '../../domain/decisionPlan/decisionPlanStorage'
import { CURSOR_AUTOMATION_SYNC_EVENT } from '../../domain/cursorAutomation/cursorAutomationStorage'
import { CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT } from '../../domain/cursorAutomation/cursorAutomationSubmitStorage'

/** Keys cleared before each demo run — real data removed, not mocked. */
export const MOBILE_DEMO_RESET_STORAGE_KEYS = [
  'ai-company-employee-work-queue',
  'ai-company-max-worker-loops',
  'ai-company-runtime-runs',
  'ai-company-reports',
  'ai-company-approvals',
  'ai-company-employee-daily-journal',
  'ai-company-employee-operating-day-summaries',
  'ai-company-operating-days',
  'ai-company-operating-day-sessions',
  'ai-company-task-results',
  'ai-company-events',
  'ai-company-run-history',
  'ai-company-notifications',
  'ai-company-memory-evolution',
  'ai-company-knowledge',
  'ai-company-tool-executions',
  'ai-company-cursor-automation-runs',
  'ai-company-cursor-automation-owner-approvals',
  'ai-company-cursor-automation-submit-runs',
  'ai-company-decision-plans',
  'ai-company-runtime-logs',
] as const

const DOMAIN_SYNC_EVENTS = [
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
  MAX_WORKER_LOOP_SYNC_EVENT,
  EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT,
  EMPLOYEE_OPERATING_DAY_SYNC_EVENT,
  EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT,
  DECISION_PLAN_SYNC_EVENT,
  CURSOR_AUTOMATION_SYNC_EVENT,
  CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT,
  MOBILE_DEMO_SYNC_EVENT,
  'ai-company-approval-sync',
  'ai-company-presence-sync',
] as const

function emitDomainRefresh(): void {
  if (typeof window === 'undefined') return
  for (const eventName of DOMAIN_SYNC_EVENTS) {
    window.dispatchEvent(new Event(eventName))
  }
}

export function resetMobileDemoRuntimeData(): void {
  if (typeof window === 'undefined') return
  for (const key of MOBILE_DEMO_RESET_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  }
  markMobileDemoReset()
  emitDomainRefresh()
}
