/**
 * Employee Registry V2 — domain types (AI-COMPANY-112A).
 */

export const EMPLOYEE_REGISTRY_VERSION = 'v1' as const

export const EMPLOYEE_STATUSES = [
  'active',
  'available',
  'busy',
  'offline',
  'planned',
  'onboarding',
] as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYEE_AVAILABILITY = [
  'active',
  'limited',
  'placeholder',
  'inactive',
] as const

export type EmployeeAvailability = (typeof EMPLOYEE_AVAILABILITY)[number]

export const EMPLOYEE_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const

export type EmployeeSkillLevel = (typeof EMPLOYEE_SKILL_LEVELS)[number]

export type EmployeeRole = {
  id: string
  title: string
  department: string
}

export type EmployeeSkill = {
  id: string
  label: string
  level: EmployeeSkillLevel
}

export type EmployeeCapability = {
  id: string
  label: string
  enabled: boolean
}

export type EmployeeExperienceProfile = {
  summary: string
  yearsEquivalent: number | null
  focusAreas: string[]
}

export type EmployeeProfile = {
  version: typeof EMPLOYEE_REGISTRY_VERSION
  employeeId: string
  displayName: string
  title: string
  department: string
  avatar: string | null
  status: EmployeeStatus
  role: EmployeeRole
  skills: EmployeeSkill[]
  capabilities: EmployeeCapability[]
  currentWorkload: number
  preferredTools: string[]
  managerId: string | null
  reportsTo: string | null
  experienceProfile: EmployeeExperienceProfile
  availability: EmployeeAvailability
  /** Mobile roster slot key when applicable. */
  rosterSlotId: 'max' | 'atlas' | 'sentinel' | 'builder' | null
  updatedAt: string
}

export type EmployeeRegistryStore = {
  version: typeof EMPLOYEE_REGISTRY_VERSION
  statusOverrides: Record<string, EmployeeStatus>
  updatedAt: string
}

export function isEmployeeStatus(value: string): value is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(value)
}

export function isEmployeeAvailability(value: string): value is EmployeeAvailability {
  return (EMPLOYEE_AVAILABILITY as readonly string[]).includes(value)
}
