/**
 * Mobile-enabled digital employees — registry & capabilities (AI-COMPANY-112C).
 * Reuse MAX architecture without duplicating mobile flows per employee.
 */

import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import {
  EMPLOYEE_ROUTE_IDS,
  resolveCanonicalEmployeeId,
} from '../../mission-control/data/employeeIdResolver'

export const BUILDER_EMPLOYEE_ID = 'ag-builder' as const

export type MobileEmployeeCapability =
  | 'profile'
  | 'chat'
  | 'work_queue'
  | 'operating_day'
  | 'daily_journal'
  | 'reports'
  | 'conversation_memory'
  | 'runtime_live'
  | 'worker_loop'
  | 'cursor_handoff'
  | 'standard_task_quick_start'

export type MobileEmployeeRegistryEntry = {
  employeeId: string
  /** URL segment: /mobile/employees/{routeAlias}, /mobile/chat/{routeAlias} */
  routeAlias: string
  capabilities: readonly MobileEmployeeCapability[]
}

const MOBILE_EMPLOYEE_REGISTRY: MobileEmployeeRegistryEntry[] = [
  {
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    routeAlias: 'ag-max',
    capabilities: [
      'profile',
      'chat',
      'work_queue',
      'operating_day',
      'daily_journal',
      'reports',
      'conversation_memory',
      'runtime_live',
      'worker_loop',
      'cursor_handoff',
      'standard_task_quick_start',
    ],
  },
  {
    employeeId: BUILDER_EMPLOYEE_ID,
    routeAlias: 'ag-builder',
    capabilities: [
      'profile',
      'chat',
      'work_queue',
      'operating_day',
      'daily_journal',
      'reports',
      'conversation_memory',
      'runtime_live',
      'worker_loop',
    ],
  },
]

const REGISTRY_BY_ID = new Map(
  MOBILE_EMPLOYEE_REGISTRY.map((entry) => [entry.employeeId, entry] as const),
)

const REGISTRY_BY_ROUTE = new Map<string, MobileEmployeeRegistryEntry>()
for (const entry of MOBILE_EMPLOYEE_REGISTRY) {
  REGISTRY_BY_ROUTE.set(entry.employeeId, entry)
  REGISTRY_BY_ROUTE.set(entry.employeeId.toLowerCase(), entry)
  REGISTRY_BY_ROUTE.set(entry.routeAlias, entry)
  REGISTRY_BY_ROUTE.set(entry.routeAlias.toLowerCase(), entry)
}

const builderEntry = REGISTRY_BY_ID.get(BUILDER_EMPLOYEE_ID)
if (builderEntry) {
  REGISTRY_BY_ROUTE.set('builder', builderEntry)
  REGISTRY_BY_ROUTE.set('builder'.toLowerCase(), builderEntry)
}

export function listMobileEmployeeRegistry(): readonly MobileEmployeeRegistryEntry[] {
  return MOBILE_EMPLOYEE_REGISTRY
}

export function getMobileEmployeeRegistryEntry(
  employeeId: string,
): MobileEmployeeRegistryEntry | null {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  return REGISTRY_BY_ID.get(canonical) ?? null
}

export function resolveMobileEmployeeFromRoute(rawRoute: string): MobileEmployeeRegistryEntry | null {
  const trimmed = rawRoute.trim()
  if (!trimmed) return null
  const canonical = resolveCanonicalEmployeeId(trimmed)
  return REGISTRY_BY_ROUTE.get(trimmed) ?? REGISTRY_BY_ROUTE.get(trimmed.toLowerCase()) ?? REGISTRY_BY_ID.get(canonical) ?? null
}

export function isMobileEmployeeEnabled(employeeId: string): boolean {
  return getMobileEmployeeRegistryEntry(employeeId) !== null
}

export function hasMobileEmployeeCapability(
  employeeId: string,
  capability: MobileEmployeeCapability,
): boolean {
  const entry = getMobileEmployeeRegistryEntry(employeeId)
  if (!entry) return false
  return entry.capabilities.includes(capability)
}

export function mobileEmployeeRouteAlias(employeeId: string): string {
  const entry = getMobileEmployeeRegistryEntry(employeeId)
  return entry?.routeAlias ?? resolveCanonicalEmployeeId(employeeId)
}

export function mobileEmployeeProfilePath(employeeId: string): string {
  return `/mobile/employees/${mobileEmployeeRouteAlias(employeeId)}`
}

export function mobileEmployeeChatPath(employeeId: string): string {
  return `/mobile/chat/${mobileEmployeeRouteAlias(employeeId)}`
}

export function mobileEmployeeTasksNewPath(employeeId: string): string {
  return `/mobile/tasks/new?employee=${encodeURIComponent(resolveCanonicalEmployeeId(employeeId))}`
}

/** Primary mobile employee for default redirects. */
export function getDefaultMobileEmployeeId(): string {
  return MAX_WORKER_EMPLOYEE_ID
}

export { EMPLOYEE_ROUTE_IDS }
