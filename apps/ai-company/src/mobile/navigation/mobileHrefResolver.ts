import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'
import { MOBILE_STANDARD_TASK_TEMPLATE_ID } from '../runTask/mobileRunTaskConfig'

export const MOBILE_PATHS = {
  today: '/mobile/today',
  employees: '/mobile/employees',
  max: `/mobile/employees/${MAX_WORKER_EMPLOYEE_ID}`,
  tasksNew: '/mobile/tasks/new',
  tasksNewMax: `/mobile/tasks/new?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`,
  standardTaskNewMax: `/mobile/tasks/new?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}&template=${MOBILE_STANDARD_TASK_TEMPLATE_ID}`,
  tasks: '/mobile/tasks',
  decisions: '/mobile/decisions',
  reports: '/mobile/reports',
  morningReport: `/mobile/reports/${MOBILE_MORNING_REPORT_ID}`,
  more: '/mobile/more',
  ops: '/ops',
} as const

function isMaxEmployeeId(raw: string): boolean {
  return resolveCanonicalEmployeeId(raw) === MAX_WORKER_EMPLOYEE_ID
}

export function resolveMobileHref(href: string): string {
  if (!href || href.startsWith('#')) return href

  if (href === '/ops/morning-report' || href.startsWith('/ops/morning-report?')) {
    return MOBILE_PATHS.morningReport
  }

  const reportMatch = href.match(/^\/ops\/reports\/([^/?#]+)/)
  if (reportMatch) {
    return `/mobile/reports/${encodeURIComponent(reportMatch[1])}`
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
