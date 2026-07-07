/**
 * Employee Brain V1 — localStorage persistence (AI-COMPANY-101D).
 * Not consumed by Runtime orchestrator in this phase.
 */

import type { CustomEmployee } from '../../mission-control/data/customEmployees'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import type { EmployeeBrainV1, UpdateEmployeeBrainInput } from './employeeBrain'
import { buildEmployeeBrainId } from './employeeBrain'
import { buildDefaultEmployeeBrainV1 } from './employeeBrainDefaults'
import {
  BRAIN_AUTONOMY_LEVELS,
  BRAIN_DECISION_STYLES,
  BRAIN_LANGUAGE_PREFERENCES,
  BRAIN_MODEL_ROUTING_POLICIES,
  BRAIN_REASONING_DEPTHS,
  BRAIN_REASONING_STRUCTURES,
  BRAIN_RISK_TOLERANCE,
  BRAIN_TOOL_SELECTION_POLICIES,
  EMPLOYEE_BRAIN_V1_VERSION,
  type BrainAutonomyLevel,
  type BrainDecisionStyle,
  type BrainRiskTolerance,
} from './employeeBrainTypes'
import { projectEmployeeBrainFromCustomEmployee } from './employeeBrainProjector'
import { isToolRegistryV1ToolId, TOOL_RISK_LEVELS } from '../toolRegistry/toolRegistry'

const STORAGE_KEY = 'ai-company-employee-brain'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function parseToolIds(value: unknown): EmployeeBrainV1['toolStrategy']['preferredToolIds'] {
  return parseStringArray(value).filter(isToolRegistryV1ToolId)
}

function parseSpecialization(raw: unknown): EmployeeBrainV1['specialization'] | null {
  if (!isRecord(raw)) return null
  if (typeof raw.primaryRole !== 'string') return null
  return {
    primaryRole: raw.primaryRole,
    domains: parseStringArray(raw.domains),
    secondaryRoles: parseStringArray(raw.secondaryRoles),
    summary: typeof raw.summary === 'string' ? raw.summary : '',
  }
}

function parseDecisionProfile(raw: unknown): EmployeeBrainV1['decisionProfile'] | null {
  if (!isRecord(raw)) return null
  return {
    style: parseEnum(raw.style, BRAIN_DECISION_STYLES, 'balanced'),
    priorityPrinciples: parseStringArray(raw.priorityPrinciples),
    evidenceFirst: raw.evidenceFirst !== false,
    preferReversibleSteps: raw.preferReversibleSteps !== false,
  }
}

function parseModelStrategy(raw: unknown): EmployeeBrainV1['modelStrategy'] | null {
  if (!isRecord(raw)) return null
  return {
    routingPolicy: parseEnum(raw.routingPolicy, BRAIN_MODEL_ROUTING_POLICIES, 'local_first'),
    preferredModelIds: parseStringArray(raw.preferredModelIds),
    fallbackModelIds: parseStringArray(raw.fallbackModelIds),
    capabilityHints: parseStringArray(raw.capabilityHints),
    avoidModelIds: parseStringArray(raw.avoidModelIds),
    preferLocalRuntime: raw.preferLocalRuntime !== false,
  }
}

function parseToolStrategy(raw: unknown): EmployeeBrainV1['toolStrategy'] | null {
  if (!isRecord(raw)) return null
  return {
    selectionPolicy: parseEnum(raw.selectionPolicy, BRAIN_TOOL_SELECTION_POLICIES, 'registry_default'),
    preferredToolIds: parseToolIds(raw.preferredToolIds),
    avoidToolIds: parseToolIds(raw.avoidToolIds),
    requireOwnerApprovalAtOrAbove: parseEnum(
      raw.requireOwnerApprovalAtOrAbove,
      TOOL_RISK_LEVELS,
      'high',
    ),
    defaultNeedSignal:
      raw.defaultNeedSignal === 'policy' ||
      raw.defaultNeedSignal === 'capability' ||
      raw.defaultNeedSignal === 'manual'
        ? raw.defaultNeedSignal
        : 'reasoning',
    maxProposalsPerCycle:
      typeof raw.maxProposalsPerCycle === 'number' ? raw.maxProposalsPerCycle : null,
  }
}

function parseReasoningPreferences(raw: unknown): EmployeeBrainV1['reasoningPreferences'] | null {
  if (!isRecord(raw)) return null
  return {
    depth: parseEnum(raw.depth, BRAIN_REASONING_DEPTHS, 'balanced'),
    structure: parseEnum(raw.structure, BRAIN_REASONING_STRUCTURES, 'report'),
    language: parseEnum(raw.language, BRAIN_LANGUAGE_PREFERENCES, 'ru'),
    confirmAssumptions: raw.confirmAssumptions !== false,
    documentDecisions: raw.documentDecisions !== false,
    preferConcreteArtifacts: raw.preferConcreteArtifacts !== false,
  }
}

function parseConstraints(raw: unknown): EmployeeBrainV1['constraints'] | null {
  if (!isRecord(raw)) return null
  return {
    hardLimits: parseStringArray(raw.hardLimits),
    softGuidelines: parseStringArray(raw.softGuidelines),
    blockedToolIds: parseToolIds(raw.blockedToolIds),
    blockedCapabilities: parseStringArray(raw.blockedCapabilities),
    maxAutonomy: parseEnum(raw.maxAutonomy, BRAIN_AUTONOMY_LEVELS, 'propose_and_wait'),
    requiresOwnerForRiskAtOrAbove: parseEnum(
      raw.requiresOwnerForRiskAtOrAbove,
      TOOL_RISK_LEVELS,
      'high',
    ),
  }
}

function parseBrain(value: unknown): EmployeeBrainV1 | null {
  if (!isRecord(value)) return null
  if (
    value.version !== EMPLOYEE_BRAIN_V1_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const specialization = parseSpecialization(value.specialization)
  const decisionProfile = parseDecisionProfile(value.decisionProfile)
  const modelStrategy = parseModelStrategy(value.modelStrategy)
  const toolStrategy = parseToolStrategy(value.toolStrategy)
  const reasoningPreferences = parseReasoningPreferences(value.reasoningPreferences)
  const constraints = parseConstraints(value.constraints)

  if (
    !specialization ||
    !decisionProfile ||
    !modelStrategy ||
    !toolStrategy ||
    !reasoningPreferences ||
    !constraints
  ) {
    return null
  }

  return {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    id: buildEmployeeBrainId(value.employeeId),
    employeeId: value.employeeId,
    companyId: typeof value.companyId === 'string' ? value.companyId : null,
    specialization,
    decisionProfile,
    modelStrategy,
    toolStrategy,
    autonomyLevel: parseEnum(value.autonomyLevel, BRAIN_AUTONOMY_LEVELS, 'propose_and_wait'),
    acceptableRisk: parseEnum(value.acceptableRisk, BRAIN_RISK_TOLERANCE, 'low'),
    reasoningPreferences,
    constraints,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadEmployeeBrains(): EmployeeBrainV1[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseBrain).filter((item): item is EmployeeBrainV1 => item !== null)
  } catch {
    return []
  }
}

export function saveEmployeeBrains(brains: EmployeeBrainV1[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brains))
  } catch {
    /* noop */
  }
}

export function getEmployeeBrainByEmployeeId(employeeId: string): EmployeeBrainV1 | null {
  return loadEmployeeBrains().find((brain) => brain.employeeId === employeeId) ?? null
}

export function upsertEmployeeBrain(next: EmployeeBrainV1): EmployeeBrainV1 {
  const existing = loadEmployeeBrains()
  const index = existing.findIndex((item) => item.employeeId === next.employeeId)
  const merged = index >= 0 ? { ...existing[index], ...next, updatedAt: new Date().toISOString() } : next

  if (index >= 0) {
    const copy = [...existing]
    copy[index] = merged
    saveEmployeeBrains(copy)
    return merged
  }

  saveEmployeeBrains([...existing, merged])
  return merged
}

export function updateEmployeeBrain(
  employeeId: string,
  patch: UpdateEmployeeBrainInput,
): EmployeeBrainV1 | null {
  const current = getEmployeeBrainByEmployeeId(employeeId)
  if (!current) return null

  return upsertEmployeeBrain({
    ...current,
    ...patch,
    specialization: patch.specialization ? { ...current.specialization, ...patch.specialization } : current.specialization,
    decisionProfile: patch.decisionProfile
      ? { ...current.decisionProfile, ...patch.decisionProfile }
      : current.decisionProfile,
    modelStrategy: patch.modelStrategy
      ? { ...current.modelStrategy, ...patch.modelStrategy }
      : current.modelStrategy,
    toolStrategy: patch.toolStrategy
      ? { ...current.toolStrategy, ...patch.toolStrategy }
      : current.toolStrategy,
    reasoningPreferences: patch.reasoningPreferences
      ? { ...current.reasoningPreferences, ...patch.reasoningPreferences }
      : current.reasoningPreferences,
    constraints: patch.constraints
      ? { ...current.constraints, ...patch.constraints }
      : current.constraints,
    updatedAt: new Date().toISOString(),
  })
}

/** Ensures Brain exists for employee — projects from CustomEmployee when possible. */
export function ensureEmployeeBrain(
  employeeId: string,
  companyId: string | null = null,
): EmployeeBrainV1 {
  const existing = getEmployeeBrainByEmployeeId(employeeId)
  if (existing) return existing

  const custom = loadCustomEmployees().find((item) => item.id === employeeId) ?? null
  const brain = custom
    ? projectEmployeeBrainFromCustomEmployee(custom, companyId)
    : buildDefaultEmployeeBrainV1({ employeeId, role: '', skills: [], companyId })

  return upsertEmployeeBrain(brain)
}

export function ensureEmployeeBrainsForRoster(
  employees: CustomEmployee[],
  companyId: string | null = null,
): EmployeeBrainV1[] {
  return employees.map((employee) => ensureEmployeeBrain(employee.id, companyId))
}

export type EmployeeBrainStats = {
  total: number
  byAutonomy: Record<BrainAutonomyLevel, number>
  byRisk: Record<BrainRiskTolerance, number>
  byDecisionStyle: Record<BrainDecisionStyle, number>
}

export function computeEmployeeBrainStats(brains: EmployeeBrainV1[]): EmployeeBrainStats {
  const byAutonomy = Object.fromEntries(BRAIN_AUTONOMY_LEVELS.map((key) => [key, 0])) as Record<
    BrainAutonomyLevel,
    number
  >
  const byRisk = Object.fromEntries(BRAIN_RISK_TOLERANCE.map((key) => [key, 0])) as Record<
    BrainRiskTolerance,
    number
  >
  const byDecisionStyle = Object.fromEntries(BRAIN_DECISION_STYLES.map((key) => [key, 0])) as Record<
    BrainDecisionStyle,
    number
  >

  for (const brain of brains) {
    byAutonomy[brain.autonomyLevel] += 1
    byRisk[brain.acceptableRisk] += 1
    byDecisionStyle[brain.decisionProfile.style] += 1
  }

  return { total: brains.length, byAutonomy, byRisk, byDecisionStyle }
}

/** Future integration points — not wired in 101D. */
export const EMPLOYEE_BRAIN_FUTURE_CAPABILITIES = [
  'runtimeContextInjection',
  'workerLoopDecisionHints',
  'modelRouterPolicyMerge',
  'toolRegistryProposalFilter',
  'brainVersionSnapshots',
] as const

export type EmployeeBrainFutureCapability = (typeof EMPLOYEE_BRAIN_FUTURE_CAPABILITIES)[number]
