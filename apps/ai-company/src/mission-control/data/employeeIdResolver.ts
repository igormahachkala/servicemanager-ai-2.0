import { agents } from './mock'

/** Canonical built-in employee IDs — seeds, runtime, and routes must use these. */
export const CANONICAL_BUILTIN_EMPLOYEE_IDS = [
  'ag-ceo',
  'ag-cto',
  'ag-arch',
  'ag-max',
  'ag-qa',
  'ag-devops',
  'ag-coo',
  'ag-asst',
] as const

export type CanonicalBuiltinEmployeeId = (typeof CANONICAL_BUILTIN_EMPLOYEE_IDS)[number]

/** Stable route IDs for quick launch and deep links. */
export const EMPLOYEE_ROUTE_IDS = {
  atlas: 'ag-cto',
  max: 'ag-max',
  sentinel: 'ag-qa',
  helm: 'ag-devops',
  ops: 'ag-coo',
  nova: 'ag-asst',
  daedalus: 'ag-arch',
  apex: 'ag-ceo',
} as const

const STATIC_ALIASES: Record<string, string> = {
  max: EMPLOYEE_ROUTE_IDS.max,
  atlas: EMPLOYEE_ROUTE_IDS.atlas,
  sentinel: EMPLOYEE_ROUTE_IDS.sentinel,
  helm: EMPLOYEE_ROUTE_IDS.helm,
  ops: EMPLOYEE_ROUTE_IDS.ops,
  nova: EMPLOYEE_ROUTE_IDS.nova,
  daedalus: EMPLOYEE_ROUTE_IDS.daedalus,
  apex: EMPLOYEE_ROUTE_IDS.apex,
  cto: EMPLOYEE_ROUTE_IDS.atlas,
  qa: EMPLOYEE_ROUTE_IDS.sentinel,
  devops: EMPLOYEE_ROUTE_IDS.helm,
}

function buildAliasMap(): Record<string, string> {
  const map: Record<string, string> = { ...STATIC_ALIASES }

  for (const agent of agents) {
    map[agent.id] = agent.id
    map[agent.id.toLowerCase()] = agent.id
    map[agent.codename] = agent.id
    map[agent.codename.toLowerCase()] = agent.id
  }

  return map
}

const ALIAS_MAP = buildAliasMap()

/** Maps legacy slugs and codenames to canonical employee IDs; custom IDs pass through. */
export function resolveCanonicalEmployeeId(rawId: string): string {
  const trimmed = rawId.trim()
  if (!trimmed) return trimmed

  const lower = trimmed.toLowerCase()
  return ALIAS_MAP[trimmed] ?? ALIAS_MAP[lower] ?? trimmed
}

export function isEmployeeRouteAlias(rawId: string): boolean {
  const trimmed = rawId.trim()
  if (!trimmed) return false
  return resolveCanonicalEmployeeId(trimmed) !== trimmed
}

export function isKnownBuiltinEmployeeId(employeeId: string): boolean {
  return agents.some((item) => item.id === employeeId)
}
