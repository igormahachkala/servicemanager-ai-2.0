/**
 * Employee Brain V1 — curated defaults for roster employees.
 * Safe read-only seeds; Runtime does not consume these in 101D.
 */

import type { EmployeeBrainV1 } from './employeeBrain'
import { buildEmployeeBrainId } from './employeeBrain'
import type {
  BrainAutonomyLevel,
  BrainDecisionProfile,
  BrainModelSelectionStrategy,
  BrainReasoningPreferences,
  BrainToolSelectionStrategy,
} from './employeeBrainTypes'
import { EMPLOYEE_BRAIN_V1_VERSION } from './employeeBrainTypes'

type BrainPreset = Omit<EmployeeBrainV1, 'id' | 'employeeId' | 'companyId' | 'createdAt' | 'updatedAt'>

function baseConstraints(maxAutonomy: BrainAutonomyLevel) {
  return {
    hardLimits: ['No silent production deploy', 'No cross-tenant data access'],
    softGuidelines: ['Prefer local Ollama for reasoning', 'Reports-first for Owner'],
    blockedToolIds: [] as BrainToolSelectionStrategy['avoidToolIds'],
    blockedCapabilities: ['delete_production', 'ssh_prod'],
    maxAutonomy,
    requiresOwnerForRiskAtOrAbove: 'high' as const,
  }
}

function baseReasoning(overrides: Partial<BrainReasoningPreferences> = {}): BrainReasoningPreferences {
  return {
    depth: 'balanced',
    structure: 'report',
    language: 'ru',
    confirmAssumptions: true,
    documentDecisions: true,
    preferConcreteArtifacts: true,
    ...overrides,
  }
}

function baseModelStrategy(overrides: Partial<BrainModelSelectionStrategy> = {}): BrainModelSelectionStrategy {
  return {
    routingPolicy: 'local_first',
    preferredModelIds: ['model-qwen-36-27b'],
    fallbackModelIds: ['model-qwen-coder', 'model-deepseek-r1'],
    capabilityHints: ['reasoning', 'code'],
    avoidModelIds: [],
    preferLocalRuntime: true,
    ...overrides,
  }
}

function baseToolStrategy(overrides: Partial<BrainToolSelectionStrategy> = {}): BrainToolSelectionStrategy {
  return {
    selectionPolicy: 'external_executor_first',
    preferredToolIds: ['cursor-automation', 'git', 'filesystem'],
    avoidToolIds: [],
    requireOwnerApprovalAtOrAbove: 'high',
    defaultNeedSignal: 'reasoning',
    maxProposalsPerCycle: 3,
    ...overrides,
  }
}

function baseDecision(style: BrainDecisionProfile['style'], principles: string[]): BrainDecisionProfile {
  return {
    style,
    priorityPrinciples: principles,
    evidenceFirst: true,
    preferReversibleSteps: true,
  }
}

const PRESETS: Record<string, BrainPreset> = {
  'ag-max': {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    specialization: {
      primaryRole: 'Senior Developer / Ведущий разработчик',
      domains: ['Coding', 'Architecture', 'DevOps'],
      secondaryRoles: ['Code reviewer', 'MVP delivery'],
      summary: 'Прикладная разработка, concrete fixes, external executor handoff.',
    },
    decisionProfile: baseDecision('pragmatic', [
      'Working code over theoretical purity',
      'Minimal scope per ticket',
      'Owner approval before high-risk tools',
    ]),
    modelStrategy: baseModelStrategy({
      preferredModelIds: ['model-qwen-36-27b', 'model-qwen-coder'],
      capabilityHints: ['code', 'reasoning', 'fast-test'],
    }),
    toolStrategy: baseToolStrategy({
      preferredToolIds: ['cursor-automation', 'git', 'filesystem', 'terminal', 'docker'],
      selectionPolicy: 'external_executor_first',
    }),
    autonomyLevel: 'execute_with_approval',
    acceptableRisk: 'moderate',
    reasoningPreferences: baseReasoning({ depth: 'balanced', preferConcreteArtifacts: true }),
    constraints: baseConstraints('execute_with_approval'),
  },
  'ag-cto': {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    specialization: {
      primaryRole: 'AI CTO / Архитектор',
      domains: ['Architecture', 'Product Management', 'Research'],
      secondaryRoles: ['Governance', 'ADR author'],
      summary: 'System shape, invariants, trade-offs, Owner-facing architecture decisions.',
    },
    decisionProfile: baseDecision('analytical', [
      'Constitution over convenience',
      'Explicit non-goals',
      'Reversible experiments',
    ]),
    modelStrategy: baseModelStrategy({
      routingPolicy: 'quality_first',
      preferredModelIds: ['model-qwen-36-27b', 'model-deepseek-r1'],
      capabilityHints: ['reasoning', 'architecture'],
    }),
    toolStrategy: baseToolStrategy({
      selectionPolicy: 'minimal_tools',
      preferredToolIds: ['filesystem', 'git', 'github'],
      maxProposalsPerCycle: 2,
    }),
    autonomyLevel: 'propose_and_wait',
    acceptableRisk: 'low',
    reasoningPreferences: baseReasoning({ depth: 'deep', structure: 'report' }),
    constraints: baseConstraints('propose_and_wait'),
  },
  'ag-qa': {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    specialization: {
      primaryRole: 'QA Engineer / Инженер QA',
      domains: ['Testing', 'Research', 'Documentation'],
      secondaryRoles: ['Acceptance reviewer'],
      summary: 'Test paths, regression risk, demo readiness, reproducible steps.',
    },
    decisionProfile: baseDecision('conservative', [
      'Evidence before ship',
      'Explicit pass/fail gates',
      'No scope creep in test plans',
    ]),
    modelStrategy: baseModelStrategy({
      preferredModelIds: ['model-qwen-coder'],
      capabilityHints: ['code', 'fast-test'],
    }),
    toolStrategy: baseToolStrategy({
      selectionPolicy: 'minimal_tools',
      preferredToolIds: ['playwright', 'browser', 'filesystem'],
      requireOwnerApprovalAtOrAbove: 'medium',
    }),
    autonomyLevel: 'recommend',
    acceptableRisk: 'minimal',
    reasoningPreferences: baseReasoning({ structure: 'checklist' }),
    constraints: baseConstraints('recommend'),
  },
  'ag-devops': {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    specialization: {
      primaryRole: 'DevOps Engineer / Инженер DevOps',
      domains: ['DevOps', 'Architecture'],
      secondaryRoles: ['Release engineer'],
      summary: 'Deploy paths, health checks, rollback, production vs local separation.',
    },
    decisionProfile: baseDecision('conservative', [
      'Production safety first',
      'Verify after deploy',
      'No manual server edits',
    ]),
    modelStrategy: baseModelStrategy({
      routingPolicy: 'capability_match',
      capabilityHints: ['reasoning', 'ops'],
    }),
    toolStrategy: baseToolStrategy({
      preferredToolIds: ['docker', 'terminal', 'git'],
      requireOwnerApprovalAtOrAbove: 'medium',
    }),
    autonomyLevel: 'propose_and_wait',
    acceptableRisk: 'low',
    reasoningPreferences: baseReasoning({ depth: 'balanced' }),
    constraints: {
      ...baseConstraints('propose_and_wait'),
      hardLimits: [
        'No silent production deploy',
        'No cross-tenant data access',
        'No SSH prod without Owner approval',
      ],
    },
  },
}

function genericPreset(role: string, domains: string[]): BrainPreset {
  return {
    version: EMPLOYEE_BRAIN_V1_VERSION,
    specialization: {
      primaryRole: role,
      domains,
      secondaryRoles: [],
      summary: 'General digital employee decision profile.',
    },
    decisionProfile: baseDecision('balanced', ['Owner visibility', 'Least privilege', 'Reports-first']),
    modelStrategy: baseModelStrategy(),
    toolStrategy: baseToolStrategy({ selectionPolicy: 'registry_default' }),
    autonomyLevel: 'propose_and_wait',
    acceptableRisk: 'low',
    reasoningPreferences: baseReasoning(),
    constraints: baseConstraints('propose_and_wait'),
  }
}

export function getEmployeeBrainPreset(
  employeeId: string,
  role: string,
  skills: string[],
): Omit<EmployeeBrainV1, 'id' | 'employeeId' | 'companyId' | 'createdAt' | 'updatedAt'> {
  const preset = PRESETS[employeeId]
  if (preset) return preset

  return genericPreset(role || 'Digital Employee', skills.length > 0 ? skills : ['General'])
}

export function buildDefaultEmployeeBrainV1(input: {
  employeeId: string
  role: string
  skills: string[]
  companyId?: string | null
  now?: string
}): EmployeeBrainV1 {
  const now = input.now ?? new Date().toISOString()
  const preset = getEmployeeBrainPreset(input.employeeId, input.role, input.skills)

  return {
    ...preset,
    id: buildEmployeeBrainId(input.employeeId),
    employeeId: input.employeeId,
    companyId: input.companyId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export const EMPLOYEE_BRAIN_ROSTER_PRESET_IDS = Object.keys(PRESETS)
