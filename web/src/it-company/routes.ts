import { lazy, type ComponentType } from 'react'

/** Base path of the IT Company module (relative to the app root). */
export const IT_COMPANY_BASE_PATH = '/it'

export interface ItCompanyRoute {
  /** Path relative to the authenticated desktop Shell route group. */
  path: string
  Component: ComponentType
}

function lazyPage(loader: () => Promise<Record<string, ComponentType>>, exportName: string): ComponentType {
  return lazy(() => loader().then((mod) => ({ default: mod[exportName] })))
}

/** Routes mounted inside the desktop Shell (see router.tsx). */
export const IT_COMPANY_ROUTES: ItCompanyRoute[] = [
  { path: 'it', Component: lazyPage(() => import('./pages/ITCompanyPage'), 'ITCompanyPage') },
  { path: 'it/employees', Component: lazyPage(() => import('./pages/AIEmployeesPage'), 'AIEmployeesPage') },
  {
    path: 'it/employees/:slug',
    Component: lazyPage(() => import('./pages/AIEmployeeDetailsPage'), 'AIEmployeeDetailsPage'),
  },
  {
    path: 'it/mission-control',
    Component: lazyPage(() => import('./pages/MissionControlPage'), 'MissionControlPage'),
  },
  { path: 'it/ai-developer', Component: lazyPage(() => import('./pages/AIDeveloperPage'), 'AIDeveloperPage') },
]
