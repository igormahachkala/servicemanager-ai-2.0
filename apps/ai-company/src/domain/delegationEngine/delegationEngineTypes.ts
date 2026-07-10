/**
 * MAX Delegation Engine — domain types (AI-COMPANY-112B).
 *
 * MAX decides whom to assign work to. Decision layer only — no task execution.
 * Tools are NOT employees; this engine routes to digital employees only.
 */

import type {
  EmployeeConversationContext,
  EmployeeWorkingMemory,
} from '../conversationMemory/conversationMemoryTypes'

export const DELEGATION_ENGINE_VERSION = 'v1' as const

/** MAX is the decider in V1. */
export const DELEGATION_DECIDER_EMPLOYEE_ID = 'ag-max' as const

export const DELEGATION_CATEGORIES = [
  'ui_design',
  'architecture',
  'bug_investigation',
  'general',
  'unknown',
] as const

export type DelegationCategory = (typeof DELEGATION_CATEGORIES)[number]

export const DELEGATION_REASON_CODES = [
  'ui_design_match',
  'architecture_match',
  'bug_investigation_match',
  'general_max',
  'unknown_fallback',
  'conversation_context_boost',
  'working_memory_boost',
  'explicit_assignee_hint',
] as const

export type DelegationReasonCode = (typeof DELEGATION_REASON_CODES)[number]

export type DelegationTaskInput = {
  taskId?: string | null
  title: string
  description?: string
  /** Free-form task body (chat message, queue item text, …). */
  taskText?: string
  labels?: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  /** Explicit assignee hint from Owner or upstream system. */
  suggestedAssigneeId?: string | null
}

export type DelegationSignalRule = {
  id: string
  patterns: string[]
  weight: number
}

export type DelegationCandidateAvailability = 'active' | 'placeholder' | 'offline'

export type DelegationCandidate = {
  employeeId: string
  codename: string
  role: string
  specialization: string
  score: number
  matchedRuleIds: string[]
  matchedSignals: string[]
  availability: DelegationCandidateAvailability
  rank: number
}

export type DelegationReason = {
  code: DelegationReasonCode
  /** Short headline for UI — e.g. «UI redesign → Builder». */
  headline: string
  /** Owner-facing sentence — «Почему MAX выбрал Builder». */
  summary: string
  matchedSignals: string[]
  ruleId: string | null
  category: DelegationCategory
}

export type DelegationExplainability = {
  /** Full Owner sentence — primary explainability surface. */
  ownerExplanation: string
  /** Bullet rationale for inspector / debug. */
  rationale: string[]
  /** Alternative candidates considered. */
  alternatives: Array<{
    employeeId: string
    codename: string
    score: number
    whyNotChosen: string | null
  }>
  matchedTaskSignals: string[]
  conversationHints: string[]
  workingMemoryHints: string[]
}

export type DelegationDecision = {
  recommendedEmployeeId: string
  recommendedCodename: string
  recommendedRole: string
  confidence: number
  reason: DelegationReason
  explainability: DelegationExplainability
}

export type DelegationPlan = {
  id: string
  version: typeof DELEGATION_ENGINE_VERSION
  decidedByEmployeeId: typeof DELEGATION_DECIDER_EMPLOYEE_ID
  taskId: string | null
  taskTitle: string
  taskDigest: string
  category: DelegationCategory
  decision: DelegationDecision
  candidates: DelegationCandidate[]
  /** V1: decision layer only — never starts tasks. */
  executionEnabled: false
  createdAt: string
}

export type EvaluateDelegationInput = {
  task: DelegationTaskInput
  conversationContext?: EmployeeConversationContext | null
  workingMemory?: EmployeeWorkingMemory | null
  now?: Date
}

export type DelegationCatalogRule = {
  id: string
  category: DelegationCategory
  reasonCode: DelegationReasonCode
  targetEmployeeId: string
  targetCodename: string
  targetRole: string
  specialization: string
  availability: DelegationCandidateAvailability
  signals: DelegationSignalRule[]
  minScore: number
  reasonSummaryTemplate: string
  headlineTemplate: string
}

export type DelegationScoreResult = {
  score: number
  matchedSignals: string[]
  matchedRuleIds: string[]
}

export function buildDelegationTaskCorpus(task: DelegationTaskInput): string {
  return [
    task.title,
    task.description ?? '',
    task.taskText ?? '',
    ...(task.labels ?? []),
  ]
    .filter(Boolean)
    .join('\n')
}

export function digestDelegationTaskText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 120) return normalized
  return `${normalized.slice(0, 117)}…`
}
