/**
 * Delegation Plan — persistent record types (AI-COMPANY-112D).
 * MAX evaluates → Owner approves → no auto execution in V1.
 */

import type { DelegationCategory, DelegationReasonCode } from '../delegationEngine'

export const DELEGATION_PLAN_VERSION = 'v1' as const

export const DELEGATION_PLAN_STORAGE_KEY = 'ai-company-delegation-plans'

export const DELEGATION_PLAN_SYNC_EVENT = 'ai-company-delegation-plans-sync'

export const DELEGATION_PLAN_STATUSES = [
  'proposed',
  'awaiting_owner',
  'approved',
  'rejected',
  'delegated',
  'cancelled',
  'failed',
] as const

export type DelegationPlanStatus = (typeof DELEGATION_PLAN_STATUSES)[number]

export const DELEGATION_PLAN_OWNER_DECISIONS = ['pending', 'approved', 'rejected'] as const

export type DelegationPlanOwnerDecision = (typeof DELEGATION_PLAN_OWNER_DECISIONS)[number]

export const DELEGATION_PLAN_HISTORY_KINDS = [
  'proposed',
  'awaiting_owner',
  'approved',
  'rejected',
  'delegated',
  'cancelled',
  'failed',
] as const

export type DelegationPlanHistoryKind = (typeof DELEGATION_PLAN_HISTORY_KINDS)[number]

export type DelegationPlanAlternative = {
  employeeId: string
  codename: string
  whyNotChosen: string | null
}

export type DelegationPlanStructuredPayload = {
  enginePlanId: string
  evaluationVersion: string
  category: DelegationCategory
  taskId: string | null
  reasonCode: DelegationReasonCode
  reasonHeadline: string
  reasonSummary: string
  matchedTaskSignals: string[]
  conversationHints: string[]
  workingMemoryHints: string[]
  technicalRationale: string[]
}

export type DelegationPlanHistoryEntry = {
  id: string
  kind: DelegationPlanHistoryKind
  at: string
  message: string | null
}

export type DelegationPlanRecord = {
  id: string
  version: typeof DELEGATION_PLAN_VERSION
  companyId: string
  originEmployeeId: string
  recommendedEmployeeId: string
  recommendedEmployeeCodename: string
  recommendedEmployeeRole: string
  taskTitle: string
  taskText: string
  structuredPayload: DelegationPlanStructuredPayload
  confidence: number
  /** Primary Owner-facing explanation — no raw score in this text. */
  ownerExplanation: string
  rationale: string[]
  alternatives: DelegationPlanAlternative[]
  matchedSignals: string[]
  risk: string | null
  status: DelegationPlanStatus
  createdAt: string
  decidedAt: string | null
  ownerDecision: DelegationPlanOwnerDecision
  targetWorkItemId: string | null
  sourceTaskId: string | null
  requiresOwnerApproval: boolean
  history: DelegationPlanHistoryEntry[]
}

export type CreateDelegationPlanInput = {
  companyId: string
  originEmployeeId: string
  recommendedEmployeeId: string
  recommendedEmployeeCodename: string
  recommendedEmployeeRole: string
  taskTitle: string
  taskText: string
  structuredPayload: DelegationPlanStructuredPayload
  confidence: number
  ownerExplanation: string
  rationale: string[]
  alternatives: DelegationPlanAlternative[]
  matchedSignals: string[]
  risk: string | null
  sourceTaskId?: string | null
  requiresOwnerApproval?: boolean
}

export type ListDelegationPlansFilter = {
  companyId?: string
  status?: DelegationPlanStatus | DelegationPlanStatus[]
  awaitingOwnerOnly?: boolean
}
