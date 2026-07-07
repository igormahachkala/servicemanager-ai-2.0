/**
 * Employee Brain V1 — decision-layer types (AI-COMPANY-101D).
 *
 * Brain ≠ LLM, Memory, Knowledge.
 * Не подключено к Runtime orchestrator в 101D.
 *
 * @see docs/ai-company/AI-COMPANY-101D-employee-brain-v1.md
 */

import type { ToolNeedSignalSource, ToolRiskLevel } from '../toolRegistry/toolRegistry'
import type { ToolRegistryV1ToolId } from '../toolRegistry/toolRegistry'

export const EMPLOYEE_BRAIN_V1_VERSION = 'v1' as const

/** Как сотрудник принимает решения — policy, не prompt. */
export const BRAIN_DECISION_STYLES = [
  'analytical',
  'pragmatic',
  'conservative',
  'exploratory',
  'balanced',
] as const

export type BrainDecisionStyle = (typeof BRAIN_DECISION_STYLES)[number]

/** Допустимая автономность без подмены Owner accountability. */
export const BRAIN_AUTONOMY_LEVELS = [
  'observe_only',
  'recommend',
  'propose_and_wait',
  'execute_low_risk',
  'execute_with_approval',
] as const

export type BrainAutonomyLevel = (typeof BRAIN_AUTONOMY_LEVELS)[number]

/** Толерантность к риску на уровне Brain — до Tool Registry policy overlay. */
export const BRAIN_RISK_TOLERANCE = ['minimal', 'low', 'moderate', 'elevated'] as const

export type BrainRiskTolerance = (typeof BRAIN_RISK_TOLERANCE)[number]

/** Стратегия выбора модели — hint для Model Router, не binding. */
export const BRAIN_MODEL_ROUTING_POLICIES = [
  'employee_preference',
  'local_first',
  'quality_first',
  'cost_first',
  'capability_match',
] as const

export type BrainModelRoutingPolicy = (typeof BRAIN_MODEL_ROUTING_POLICIES)[number]

/** Стратегия выбора инструментов — до Permission / Tool Registry gate. */
export const BRAIN_TOOL_SELECTION_POLICIES = [
  'minimal_tools',
  'registry_default',
  'external_executor_first',
  'manual_only',
] as const

export type BrainToolSelectionPolicy = (typeof BRAIN_TOOL_SELECTION_POLICIES)[number]

export const BRAIN_REASONING_DEPTHS = ['brief', 'balanced', 'deep'] as const

export type BrainReasoningDepth = (typeof BRAIN_REASONING_DEPTHS)[number]

export const BRAIN_REASONING_STRUCTURES = ['freeform', 'report', 'checklist'] as const

export type BrainReasoningStructure = (typeof BRAIN_REASONING_STRUCTURES)[number]

export const BRAIN_LANGUAGE_PREFERENCES = ['ru', 'en', 'match_owner'] as const

export type BrainLanguagePreference = (typeof BRAIN_LANGUAGE_PREFERENCES)[number]

/** Специализация — who this employee is as a decision-maker. */
export type BrainSpecialization = {
  /** Primary org role line, e.g. Senior Developer. */
  primaryRole: string
  /** Declared competency domains. */
  domains: string[]
  /** Optional secondary hats (reviewer, architect, …). */
  secondaryRoles: string[]
  /** Short capability statement for Owner-facing summaries. */
  summary: string
}

/** Стиль принятия решений — how trade-offs are weighed. */
export type BrainDecisionProfile = {
  style: BrainDecisionStyle
  /** Ordered principles when options conflict. */
  priorityPrinciples: string[]
  /** Prefer evidence before action. */
  evidenceFirst: boolean
  /** Prefer reversible steps over big-bang changes. */
  preferReversibleSteps: boolean
}

/** Стратегия выбора моделей — preferences for Runtime Model Router. */
export type BrainModelSelectionStrategy = {
  routingPolicy: BrainModelRoutingPolicy
  /** Catalog model ids (Runtime), not vendor strings. */
  preferredModelIds: string[]
  fallbackModelIds: string[]
  /** Capability tags: code, vision, reasoning, fast-test, … */
  capabilityHints: string[]
  avoidModelIds: string[]
  /** Prefer local Ollama when healthy. */
  preferLocalRuntime: boolean
}

/** Стратегия выбора инструментов — before Permission merge. */
export type BrainToolSelectionStrategy = {
  selectionPolicy: BrainToolSelectionPolicy
  preferredToolIds: ToolRegistryV1ToolId[]
  avoidToolIds: ToolRegistryV1ToolId[]
  /** Brain stops proposing tools above this registry risk without Owner path. */
  requireOwnerApprovalAtOrAbove: ToolRiskLevel
  defaultNeedSignal: ToolNeedSignalSource
  /** Max tool proposals per Worker Loop cycle (null = platform default). */
  maxProposalsPerCycle: number | null
}

/** Предпочтения reasoning — shape of thinking, not stored outcomes. */
export type BrainReasoningPreferences = {
  depth: BrainReasoningDepth
  structure: BrainReasoningStructure
  language: BrainLanguagePreference
  /** Ask Owner before non-obvious assumptions. */
  confirmAssumptions: boolean
  /** Emit structured Runtime Report sections when applicable. */
  documentDecisions: boolean
  /** Prefer citing files/modules over generic advice. */
  preferConcreteArtifacts: boolean
}

/** Ограничения Brain — guardrails distinct from Permission profile. */
export type BrainConstraints = {
  hardLimits: string[]
  softGuidelines: string[]
  blockedToolIds: ToolRegistryV1ToolId[]
  blockedCapabilities: string[]
  /** Brain autonomy ceiling — cannot exceed Owner policy. */
  maxAutonomy: BrainAutonomyLevel
  requiresOwnerForRiskAtOrAbove: ToolRiskLevel
}
