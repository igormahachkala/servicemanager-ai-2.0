import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export const MOBILE_GUIDE_TARGET_ATTR = 'data-mobile-guide'

export type MobileFirstLaunchGuideStepId =
  | 'welcome'
  | 'today'
  | 'employees'
  | 'max'
  | 'assign-task'
  | 'runtime'
  | 'reports'
  | 'decisions'
  | 'complete'

export type MobileFirstLaunchGuideStep = {
  id: MobileFirstLaunchGuideStepId
  route: string
  targets: string[]
  primaryAction?: 'next' | 'open-max' | 'assign-first-task'
  secondaryAction?: 'close-guide'
}

export const MOBILE_FIRST_LAUNCH_GUIDE_STEPS: MobileFirstLaunchGuideStep[] = [
  {
    id: 'welcome',
    route: MOBILE_PATHS.today,
    targets: [],
  },
  {
    id: 'today',
    route: MOBILE_PATHS.today,
    targets: ['company-status', 'next-action', 'employee-results'],
  },
  {
    id: 'employees',
    route: MOBILE_PATHS.employees,
    targets: ['max-roster'],
    primaryAction: 'open-max',
  },
  {
    id: 'max',
    route: MOBILE_PATHS.max,
    targets: ['max-workday', 'max-queue', 'max-result', 'max-runtime'],
  },
  {
    id: 'assign-task',
    route: MOBILE_PATHS.tasksNewMax,
    targets: ['task-templates', 'task-composer'],
  },
  {
    id: 'runtime',
    route: MOBILE_PATHS.runtime,
    targets: ['runtime-overview'],
  },
  {
    id: 'reports',
    route: MOBILE_PATHS.reports,
    targets: ['reports-morning', 'reports-list'],
  },
  {
    id: 'decisions',
    route: MOBILE_PATHS.decisions,
    targets: ['decisions-overview'],
  },
  {
    id: 'complete',
    route: MOBILE_PATHS.today,
    targets: [],
    primaryAction: 'assign-first-task',
    secondaryAction: 'close-guide',
  },
]

export function mobileGuideStepCount(): number {
  return MOBILE_FIRST_LAUNCH_GUIDE_STEPS.length
}

export function mobileGuideRouteMatches(pathname: string, search: string, route: string): boolean {
  const [path, queryString] = route.split('?')

  let pathMatches = pathname === path
  if (!pathMatches && path === MOBILE_PATHS.runtime) {
    pathMatches = pathname.startsWith(`${path}/`)
  }
  if (!pathMatches) return false

  if (!queryString) return true

  const expected = new URLSearchParams(queryString)
  const current = new URLSearchParams(search)
  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false
  }
  return true
}

export function mobileGuideTargetSelector(targetId: string): string {
  return `[${MOBILE_GUIDE_TARGET_ATTR}="${targetId}"]`
}

export function mobileGuideUnionRect(elements: Element[]): DOMRect | null {
  if (elements.length === 0) return null

  let top = Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) continue
    top = Math.min(top, rect.top)
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
    bottom = Math.max(bottom, rect.bottom)
  }

  if (!Number.isFinite(top)) return null

  const padding = 8
  return new DOMRect(
    Math.max(0, left - padding),
    Math.max(0, top - padding),
    right - left + padding * 2,
    bottom - top + padding * 2,
  )
}
