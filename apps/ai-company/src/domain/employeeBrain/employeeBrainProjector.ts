/**
 * Employee Brain V1 — projector from CustomEmployee (read-only, no Runtime).
 */

import type { CustomEmployee } from '../../mission-control/data/customEmployees'
import { resolveModelIdFromLabel } from '../runtime/modelProvider'
import { isToolRegistryV1ToolId, type ToolRegistryV1ToolId } from '../toolRegistry/toolRegistry'
import type { EmployeeBrainV1 } from './employeeBrain'
import { buildEmployeeBrainId } from './employeeBrain'
import { buildDefaultEmployeeBrainV1 } from './employeeBrainDefaults'
import type {
  BrainAutonomyLevel,
  BrainModelSelectionStrategy,
  BrainRiskTolerance,
  BrainToolSelectionStrategy,
} from './employeeBrainTypes'

const TOOL_LABEL_TO_REGISTRY_ID: Record<string, ToolRegistryV1ToolId> = {
  GitHub: 'github',
  Cursor: 'cursor-automation',
  Docker: 'docker',
  Filesystem: 'filesystem',
  Codex: 'codex-cli',
  Ollama: 'filesystem',
  'Open WebUI': 'browser',
  OpenHands: 'claude-code-cli',
  Aider: 'claude-code-cli',
  PostgreSQL: 'filesystem',
  Figma: 'filesystem',
  n8n: 'filesystem',
}

function mapToolLabels(labels: string[]): ToolRegistryV1ToolId[] {
  const ids = new Set<ToolRegistryV1ToolId>()
  for (const label of labels) {
    const mapped = TOOL_LABEL_TO_REGISTRY_ID[label]
    if (mapped) ids.add(mapped)
  }
  return [...ids]
}

function inferAutonomy(restrictions: string[]): BrainAutonomyLevel {
  if (restrictions.some((item) => /requires approval/i.test(item))) {
    return 'execute_with_approval'
  }
  if (restrictions.some((item) => /no production|no delete|no git push/i.test(item))) {
    return 'propose_and_wait'
  }
  return 'execute_with_approval'
}

function inferRiskTolerance(restrictions: string[]): BrainRiskTolerance {
  if (restrictions.length >= 3) return 'minimal'
  if (restrictions.some((item) => /production|delete|database write/i.test(item))) return 'low'
  return 'moderate'
}

function buildModelStrategyFromEmployee(employee: CustomEmployee): BrainModelSelectionStrategy {
  const preferred = employee.primaryModel
    ? [resolveModelIdFromLabel(employee.primaryModel)]
    : ['model-qwen-36-27b']
  const fallback = employee.fallbackModels.map(resolveModelIdFromLabel).filter(Boolean)

  return {
    routingPolicy: preferred.some((id) => id.startsWith('model-')) ? 'local_first' : 'employee_preference',
    preferredModelIds: preferred,
    fallbackModelIds: fallback.length > 0 ? fallback : ['model-qwen-coder'],
    capabilityHints: employee.skills.some((s) => /coding|devops|architecture/i.test(s))
      ? ['code', 'reasoning']
      : ['reasoning'],
    avoidModelIds: [],
    preferLocalRuntime: true,
  }
}

function buildToolStrategyFromEmployee(employee: CustomEmployee): BrainToolSelectionStrategy {
  const preferredToolIds = mapToolLabels(employee.tools)
  const hasCursor = preferredToolIds.includes('cursor-automation')

  return {
    selectionPolicy: hasCursor ? 'external_executor_first' : 'registry_default',
    preferredToolIds: preferredToolIds.length > 0 ? preferredToolIds : ['filesystem', 'git'],
    avoidToolIds: [],
    requireOwnerApprovalAtOrAbove: employee.permissions.productionDeploy ? 'high' : 'medium',
    defaultNeedSignal: 'reasoning',
    maxProposalsPerCycle: 3,
  }
}

/**
 * Projects a Brain snapshot from CustomEmployee + roster preset overlay.
 * Does not write storage; safe for future Runtime context assembly.
 */
export function projectEmployeeBrainFromCustomEmployee(
  employee: CustomEmployee,
  companyId: string | null = null,
): EmployeeBrainV1 {
  const base = buildDefaultEmployeeBrainV1({
    employeeId: employee.id,
    role: employee.role,
    skills: employee.skills,
    companyId,
  })

  const modelStrategy = buildModelStrategyFromEmployee(employee)
  const toolStrategy = buildToolStrategyFromEmployee(employee)
  const autonomyLevel = inferAutonomy(employee.restrictions)
  const acceptableRisk = inferRiskTolerance(employee.restrictions)

  const hardLimits = [
    ...new Set([...base.constraints.hardLimits, ...employee.restrictions]),
  ]

  const blockedFromRestrictions = employee.restrictions
    .flatMap((item) => {
      if (/production deploy/i.test(item)) return ['deploy'] as const
      if (/database write/i.test(item)) return ['postgresql_write'] as const
      if (/git push/i.test(item)) return ['git_push'] as const
      return []
    })
    .map(String)

  return {
    ...base,
    id: buildEmployeeBrainId(employee.id),
    specialization: {
      ...base.specialization,
      primaryRole: employee.role || base.specialization.primaryRole,
      domains: employee.skills.length > 0 ? employee.skills : base.specialization.domains,
      summary: employee.description.trim() || base.specialization.summary,
    },
    modelStrategy,
    toolStrategy,
    autonomyLevel,
    acceptableRisk,
    constraints: {
      ...base.constraints,
      hardLimits,
      softGuidelines: employee.workflow.trim()
        ? [employee.workflow.trim(), ...base.constraints.softGuidelines]
        : base.constraints.softGuidelines,
      blockedCapabilities: [
        ...new Set([...base.constraints.blockedCapabilities, ...blockedFromRestrictions]),
      ],
      maxAutonomy: autonomyLevel,
    },
    updatedAt: new Date().toISOString(),
  }
}

export function mergeToolIdsSafely(values: string[]): ToolRegistryV1ToolId[] {
  return values.filter(isToolRegistryV1ToolId)
}
