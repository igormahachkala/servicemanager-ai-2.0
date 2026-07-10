/**
 * Build persistent DelegationPlanRecord from MAX Delegation Engine evaluation (112D).
 */

import {
  DELEGATION_DECIDER_EMPLOYEE_ID,
  type DelegationPlan as DelegationEnginePlan,
} from '../delegationEngine'
import { DEFAULT_COMPANY_ID } from '../company/company'
import { createDelegationPlan } from './delegationPlanStorage'
import {
  formatDelegationPlanPrimaryExplanation,
  resolveDelegationPlanRisk,
  sanitizeAlternativesForOwner,
} from './delegationPlanOwnerExplain'
import type { DelegationPlanRecord } from './delegationPlanTypes'

export type CreateDelegationPlanFromEvaluationInput = {
  evaluation: DelegationEnginePlan
  companyId?: string
  taskText?: string
  sourceTaskId?: string | null
}

export function createDelegationPlanFromEvaluation(
  input: CreateDelegationPlanFromEvaluationInput,
): DelegationPlanRecord {
  const { evaluation } = input
  const decision = evaluation.decision
  const explain = decision.explainability

  const ownerExplanation = formatDelegationPlanPrimaryExplanation({
    recommendedCodename: decision.recommendedCodename,
    category: evaluation.category,
    reasonSummary: decision.reason.summary,
  })

  const alternatives = sanitizeAlternativesForOwner(
    explain.alternatives.map((item) => ({
      employeeId: item.employeeId,
      codename: item.codename,
      whyNotChosen: item.whyNotChosen,
    })),
  )

  const requiresOwnerApproval =
    decision.recommendedEmployeeId !== DELEGATION_DECIDER_EMPLOYEE_ID

  return createDelegationPlan({
    companyId: input.companyId ?? DEFAULT_COMPANY_ID,
    originEmployeeId: evaluation.decidedByEmployeeId,
    recommendedEmployeeId: decision.recommendedEmployeeId,
    recommendedEmployeeCodename: decision.recommendedCodename,
    recommendedEmployeeRole: decision.recommendedRole,
    taskTitle: evaluation.taskTitle,
    taskText: input.taskText?.trim() || evaluation.taskDigest,
    structuredPayload: {
      enginePlanId: evaluation.id,
      evaluationVersion: evaluation.version,
      category: evaluation.category,
      taskId: evaluation.taskId,
      reasonCode: decision.reason.code,
      reasonHeadline: decision.reason.headline,
      reasonSummary: decision.reason.summary,
      matchedTaskSignals: explain.matchedTaskSignals,
      conversationHints: explain.conversationHints,
      workingMemoryHints: explain.workingMemoryHints,
      technicalRationale: explain.rationale,
    },
    confidence: decision.confidence,
    ownerExplanation,
    rationale: explain.rationale,
    alternatives,
    matchedSignals: explain.matchedTaskSignals,
    risk: resolveDelegationPlanRisk(evaluation.category),
    sourceTaskId: input.sourceTaskId ?? evaluation.taskId,
    requiresOwnerApproval,
  })
}
