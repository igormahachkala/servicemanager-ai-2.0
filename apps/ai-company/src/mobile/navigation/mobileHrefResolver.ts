import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import {
  BUILDER_EMPLOYEE_ID,
  mobileEmployeeChatPath,
  mobileEmployeeProfilePath,
} from '../../domain/mobileEmployee'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'
import { MOBILE_STANDARD_TASK_TEMPLATE_ID } from '../runTask/mobileRunTaskConfig'

export const MOBILE_PATHS = {
  today: '/mobile/today',
  employees: '/mobile/employees',
  max: mobileEmployeeProfilePath(MAX_WORKER_EMPLOYEE_ID),
  builder: mobileEmployeeProfilePath(BUILDER_EMPLOYEE_ID),
  tasksNew: '/mobile/tasks/new',
  cursorTask: '/mobile/cursor-task',
  tasksNewMax: `/mobile/tasks/new?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`,
  tasksNewBuilder: `/mobile/tasks/new?employee=${encodeURIComponent(BUILDER_EMPLOYEE_ID)}`,
  standardTaskNewMax: `/mobile/tasks/new?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}&template=${MOBILE_STANDARD_TASK_TEMPLATE_ID}`,
  tasks: '/mobile/tasks',
  decisions: '/mobile/decisions',
  reports: '/mobile/reports',
  morningReport: `/mobile/reports/${MOBILE_MORNING_REPORT_ID}`,
  runtime: '/mobile/runtime',
  demo: '/mobile/demo',
  chat: mobileEmployeeChatPath(MAX_WORKER_EMPLOYEE_ID),
  builderChat: mobileEmployeeChatPath(BUILDER_EMPLOYEE_ID),
  tasksHistory: '/mobile/tasks/history',
  history: '/mobile/history',
  more: '/mobile/more',
  ops: '/ops',
} as const

function isMaxEmployeeId(raw: string): boolean {
  return resolveCanonicalEmployeeId(raw) === MAX_WORKER_EMPLOYEE_ID
}

export function mobileMaxHref(employeeId: string = MAX_WORKER_EMPLOYEE_ID): string {
  return isMaxEmployeeId(employeeId) ? MOBILE_PATHS.max : MOBILE_PATHS.employees
}

export function mobileRuntimeRunHref(runId: string): string {
  return `${MOBILE_PATHS.runtime}/${encodeURIComponent(runId)}`
}

export function mobileRuntimeLoopHref(loopId: string): string {
  return `${MOBILE_PATHS.runtime}?loop=${encodeURIComponent(loopId)}`
}

export function mobileReportHref(reportId: string): string {
  return `/mobile/reports/${encodeURIComponent(reportId)}`
}

export function mobileTaskHistoryGroupHref(groupId: string): string {
  return `${MOBILE_PATHS.tasksHistory}?group=${encodeURIComponent(groupId)}`
}

export function resolveMobileHref(href: string): string {
  if (!href || href.startsWith('#')) return href

  if (href === '/ops/morning-report' || href.startsWith('/ops/morning-report?')) {
    return MOBILE_PATHS.morningReport
  }

  const runtimeRunMatch = href.match(/^\/ops\/runtime\/runs\/([^/?#]+)/)
  if (runtimeRunMatch) {
    return mobileRuntimeRunHref(decodeURIComponent(runtimeRunMatch[1]))
  }
  if (href === '/ops/runtime' || href.startsWith('/ops/runtime?') || href.startsWith('/ops/runtime/live')) {
    return MOBILE_PATHS.runtime
  }

  const reportMatch = href.match(/^\/ops\/reports\/([^/?#]+)/)
  if (reportMatch) {
    return mobileReportHref(reportMatch[1])
  }
  if (href === '/ops/reports' || href.startsWith('/ops/reports?')) {
    return MOBILE_PATHS.reports
  }

  const workspaceMatch = href.match(/^\/ops\/employees\/([^/]+)\/workspace/)
  if (workspaceMatch && isMaxEmployeeId(decodeURIComponent(workspaceMatch[1]))) {
    return MOBILE_PATHS.max
  }

  const todayMatch = href.match(/^\/ops\/employees\/([^/]+)\/today/)
  if (todayMatch && isMaxEmployeeId(decodeURIComponent(todayMatch[1]))) {
    return MOBILE_PATHS.max
  }

  if (href.startsWith('/ops/approvals')) {
    return MOBILE_PATHS.decisions
  }

  if (href.startsWith('/ops/run-task')) {
    try {
      const url = new URL(href, 'http://local')
      const employee = url.searchParams.get('employee')
      if (employee) {
        return `/mobile/tasks/new?employee=${encodeURIComponent(employee)}`
      }
    } catch {
      // fall through
    }
    return MOBILE_PATHS.tasksNew
  }

  return href
}
