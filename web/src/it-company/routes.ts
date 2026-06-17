import type { ComponentType } from 'react'

import { ITCompanyPage } from './pages/ITCompanyPage'
import { AIDeveloperPage } from './pages/AIDeveloperPage'
import { AIEmployeesPage } from './pages/AIEmployeesPage'

/** Base path of the IT Company module (relative to the app root). */
export const IT_COMPANY_BASE_PATH = '/it'

export interface ItCompanyRoute {
  /** Path relative to the authenticated desktop Shell route group. */
  path: string
  Component: ComponentType
}

/** Routes mounted inside the desktop Shell (see router.tsx). */
export const IT_COMPANY_ROUTES: ItCompanyRoute[] = [
  { path: 'it', Component: ITCompanyPage },
  { path: 'it/employees', Component: AIEmployeesPage },
  { path: 'it/ai-developer', Component: AIDeveloperPage },
]
