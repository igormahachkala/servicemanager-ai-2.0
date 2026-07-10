/**
 * Mobile chat ↔ MAX Delegation Engine bridge (AI-COMPANY-112E).
 */

import { evaluateDelegation, type DelegationPlan } from '../../domain/delegationEngine'
import {
  createDelegationPlanFromEvaluation,
} from '../../domain/delegationPlan/delegationPlanFromEvaluation'
import {
  getDelegationPlan,
  upsertDelegationPlan,
} from '../../domain/delegationPlan/delegationPlanStorage'
import { EMPLOYEE_REGISTRY_BUILTIN_IDS } from '../../domain/employeeRegistry/employeeRegistrySeed'
import { getEmployee, listEmployees } from '../../domain/employeeRegistry'
import { buildEmployeeConversationContext } from '../../domain/conversationMemory'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import type { MobileChatIntentResult } from '../../domain/mobileChatIntent'
import type {
  MobileEmployeeChatDelegationProposal,
  MobileEmployeeChatTaskProposal,
} from './mobileEmployeeChat'

export type MobileChatDelegationCopy = {
  intro: string
  afterConfirm: string
}

export type DelegationAssignableEmployee = {
  employeeId: string
  displayName: string
  title: string
  department: string
  enabled: boolean
  disabledReason: string | null
}

const DELEGATION_ROSTER_ORDER = [
  EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
  EMPLOYEE_REGISTRY_BUILTIN_IDS.builder,
  EMPLOYEE_REGISTRY_BUILTIN_IDS.atlas,
  EMPLOYEE_REGISTRY_BUILTIN_IDS.sentinel,
] as const

export function shouldEvaluateChatDelegation(
  employeeId: string,
  intent: MobileChatIntentResult,
): boolean {
  if (employeeId !== MAX_WORKER_EMPLOYEE_ID) return false
  return intent.kind === 'task_request' || intent.kind === 'complex_task_request'
}

export function evaluateChatDelegationPlan(input: {
  employeeId: string
  taskProposal: MobileEmployeeChatTaskProposal
}): DelegationPlan {
  const context = buildEmployeeConversationContext(input.employeeId)
  return evaluateDelegation({
    task: {
      title: input.taskProposal.title,
      taskText: input.taskProposal.taskText,
      description: input.taskProposal.expectedResult ?? undefined,
      priority: input.taskProposal.priority ?? 'medium',
    },
    conversationContext: context,
    workingMemory: context.workingMemory,
  })
}

export function shouldShowDelegationProposal(plan: DelegationPlan): boolean {
  return plan.decision.recommendedEmployeeId !== MAX_WORKER_EMPLOYEE_ID
}

export function resolveDelegationAssigneeProfile(employeeId: string) {
  return getEmployee(employeeId)
}

export function buildMobileChatDelegationProposal(input: {
  plan: DelegationPlan
  taskProposal: MobileEmployeeChatTaskProposal
  copy: MobileChatDelegationCopy
  selectedEmployeeId?: string | null
}): MobileEmployeeChatDelegationProposal {
  const selectedId = input.selectedEmployeeId ?? input.plan.decision.recommendedEmployeeId
  const selectedProfile = getEmployee(selectedId)
  const recommendedProfile = getEmployee(input.plan.decision.recommendedEmployeeId)

  const displayName =
    selectedProfile?.displayName ?? input.plan.decision.recommendedCodename
  const title = selectedProfile?.title ?? input.plan.decision.recommendedRole

  return {
    delegationPlanId: input.plan.id,
    recommendedEmployeeId: input.plan.decision.recommendedEmployeeId,
    selectedEmployeeId: selectedId,
    recommendedDisplayName: displayName,
    recommendedTitle: title,
    reason: input.plan.decision.explainability.ownerExplanation,
    confidence: input.plan.decision.confidence,
    expectedResult: input.taskProposal.expectedResult ?? '',
    afterConfirmSummary: input.copy.afterConfirm.replace('{employeeName}', displayName),
    alternatives: input.plan.decision.explainability.alternatives.map((item) => {
      const profile = getEmployee(item.employeeId)
      return {
        employeeId: item.employeeId,
        displayName: profile?.displayName ?? item.codename,
        title: profile?.title ?? recommendedProfile?.title ?? '',
        whyNotChosen: item.whyNotChosen,
      }
    }),
    taskProposal: input.taskProposal,
    status: 'pending',
    sourceMessageId: input.taskProposal.sourceMessageId,
  }
}

export function listDelegationAssignableEmployees(
  disabledReasonForUnavailable: string,
): DelegationAssignableEmployee[] {
  const byId = new Map(listEmployees().map((item) => [item.employeeId, item]))

  return DELEGATION_ROSTER_ORDER.map((employeeId) => {
    const profile = byId.get(employeeId)
    if (!profile) {
      return {
        employeeId,
        displayName: employeeId,
        title: '',
        department: '',
        enabled: false,
        disabledReason: disabledReasonForUnavailable,
      }
    }

    const enabled = profile.availability === 'active' || employeeId === MAX_WORKER_EMPLOYEE_ID
    return {
      employeeId: profile.employeeId,
      displayName: profile.displayName,
      title: profile.title,
      department: profile.department,
      enabled,
      disabledReason: enabled ? null : disabledReasonForUnavailable,
    }
  })
}

export function formatDelegationConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function persistChatDelegationPlan(input: {
  employeeId: string
  delegationProposal: MobileEmployeeChatDelegationProposal
}): MobileEmployeeChatDelegationProposal {
  const enginePlan = evaluateChatDelegationPlan({
    employeeId: input.employeeId,
    taskProposal: input.delegationProposal.taskProposal,
  })
  const record = createDelegationPlanFromEvaluation({
    evaluation: enginePlan,
    taskText: input.delegationProposal.taskProposal.taskText,
    sourceTaskId: input.delegationProposal.sourceMessageId,
  })
  return { ...input.delegationProposal, delegationPlanId: record.id }
}

export function updateDelegationPlanAssignee(planId: string, selectedEmployeeId: string): void {
  const plan = getDelegationPlan(planId)
  if (!plan || plan.recommendedEmployeeId === selectedEmployeeId) return
  const profile = getEmployee(selectedEmployeeId)
  upsertDelegationPlan({
    ...plan,
    recommendedEmployeeId: selectedEmployeeId,
    recommendedEmployeeCodename: profile?.displayName ?? selectedEmployeeId,
    recommendedEmployeeRole: profile?.title ?? plan.recommendedEmployeeRole,
  })
}

export function applyAssigneeToDelegationProposal(
  proposal: MobileEmployeeChatDelegationProposal,
  employeeId: string,
  copy: MobileChatDelegationCopy,
): MobileEmployeeChatDelegationProposal {
  const profile = getEmployee(employeeId)
  const displayName = profile?.displayName ?? employeeId
  const title = profile?.title ?? proposal.recommendedTitle
  return {
    ...proposal,
    selectedEmployeeId: employeeId,
    recommendedDisplayName: displayName,
    recommendedTitle: title,
    afterConfirmSummary: copy.afterConfirm.replace('{employeeName}', displayName),
  }
}
