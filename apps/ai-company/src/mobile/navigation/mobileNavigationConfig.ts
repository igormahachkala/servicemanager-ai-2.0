export type MobileNavId = 'today' | 'employees' | 'tasks' | 'decisions' | 'more'

export type MobileNavItem = {
  id: MobileNavId
  labelKey: MobileNavId
  to: string
  matchPrefix?: string
}

export const MOBILE_NAV_BASE = '/mobile'

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'today', labelKey: 'today', to: `${MOBILE_NAV_BASE}/today` },
  { id: 'employees', labelKey: 'employees', to: `${MOBILE_NAV_BASE}/employees` },
  { id: 'tasks', labelKey: 'tasks', to: `${MOBILE_NAV_BASE}/tasks` },
  { id: 'decisions', labelKey: 'decisions', to: `${MOBILE_NAV_BASE}/decisions` },
  { id: 'more', labelKey: 'more', to: `${MOBILE_NAV_BASE}/more` },
]

export function resolveMobileNavId(pathname: string): MobileNavId {
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/employees`)) return 'employees'
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/chat`)) return 'employees'
  if (
    pathname.startsWith(`${MOBILE_NAV_BASE}/tasks/history`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/history`)
  ) {
    return 'more'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/tasks`)) return 'tasks'
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/decisions`)) return 'decisions'
  if (
    pathname.startsWith(`${MOBILE_NAV_BASE}/more`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/reports`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/runtime`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/demo`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/chat`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/tasks/history`) ||
    pathname.startsWith(`${MOBILE_NAV_BASE}/history`)
  ) {
    return 'more'
  }
  return 'today'
}

export function mobilePageTitle(
  pathname: string,
  labels: Record<MobileNavId, string> & {
    runTaskNew?: string
    reports?: string
    reportDetail?: string
    runtimeLive?: string
    demo?: string
    taskHistory?: string
    chat?: string
  },
  maxTitle = 'MAX',
): string {
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/tasks/new`)) {
    return labels.runTaskNew ?? labels.tasks
  }
  if (pathname === `${MOBILE_NAV_BASE}/tasks` || pathname.startsWith(`${MOBILE_NAV_BASE}/tasks?`)) {
    return labels.tasks
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/chat`)) {
    return labels.chat ?? 'Chat'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/runtime`)) {
    return labels.runtimeLive ?? 'Runtime'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/tasks/history`) || pathname.startsWith(`${MOBILE_NAV_BASE}/history`)) {
    return labels.taskHistory ?? 'История'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/demo`)) {
    return labels.demo ?? 'Demo'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/reports/`) && pathname !== `${MOBILE_NAV_BASE}/reports`) {
    return labels.reportDetail ?? labels.reports ?? 'Отчёт'
  }
  if (pathname.startsWith(`${MOBILE_NAV_BASE}/reports`)) {
    return labels.reports ?? 'Отчёты'
  }
  if (pathname.includes('/employees/ag-max') || pathname.endsWith('/employees/max')) {
    return maxTitle
  }
  return labels[resolveMobileNavId(pathname)] ?? labels.today
}
