/**
 * AI Employees registry (summary list for the IT Company staff screen).
 *
 * Derived from the canonical profiles (profiles.ts) so there is a single source
 * of truth. Mock data; later this can be backed by an API.
 */

import { AI_EMPLOYEE_PROFILES, type AIEmployeeStatus } from './profiles'

export type { AIEmployeeStatus }

export interface AIEmployee {
  id: string
  /** URL slug → /it/employees/<slug>. */
  slug: string
  /** Codename, if the role has one (e.g. MAX). */
  codename?: string
  /** Role / workspace title. */
  role: string
  status: AIEmployeeStatus
  /** One-line mission. */
  mission: string
}

export const AI_EMPLOYEES: AIEmployee[] = AI_EMPLOYEE_PROFILES.map((p) => ({
  id: p.id,
  slug: p.slug,
  codename: p.codename,
  role: p.workspace,
  status: p.status,
  mission: p.mission,
}))

export function countByStatus(status: AIEmployeeStatus): number {
  return AI_EMPLOYEES.filter((e) => e.status === status).length
}
