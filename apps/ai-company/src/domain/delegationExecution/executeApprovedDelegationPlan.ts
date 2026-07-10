/**
 * Execute approved DelegationPlan → Employee Work Queue (AI-COMPANY-112F).
 * Does not invoke Runtime, Worker Loop, or Tool Dispatcher.
 */

import { getEmployee } from '../employeeRegistry'
import {
  getDelegationPlan,
  markDelegationPlanDelegated,
} from '../delegationPlan/delegationPlanStorage'
import type { DelegationPlanRecord } from '../delegationPlan/delegationPlanTypes'
import type { WorkItem } from '../employeeWorkQueue'
import {
  createEmployeeWorkItem,
  findEmployeeWorkItemByDelegationPlanId,
  getEmployeeWorkItemById,
} from '../employeeWorkQueue/employeeWorkQueueStorage'
import type {
  DelegationExecutionFailure,
  DelegationExecutionResult,
  DelegationExecutionSuccess,
} from './delegationExecutionTypes'
import { buildDelegationWorkItemStructuredPayload } from './delegationExecutionPayload'

function fail(
  code: DelegationExecutionFailure['code'],
  message: string,
): DelegationExecutionFailure {
  return { ok: false, code, message }
}

function success(
  workItem: WorkItem,
  plan: DelegationPlanRecord,
  idempotent: boolean,
): DelegationExecutionSuccess {
  return { ok: true, workItem, plan, idempotent }
}

function resolveExistingExecution(plan: DelegationPlanRecord): DelegationExecutionResult | null {
  if (plan.targetWorkItemId) {
    const byPlanRef = getEmployeeWorkItemById(plan.targetWorkItemId)
    if (byPlanRef) return success(byPlanRef, plan, true)
  }

  const byRef = findEmployeeWorkItemByDelegationPlanId(plan.id)
  if (byRef) {
    const syncedPlan =
      plan.status === 'delegated'
        ? plan
        : markDelegationPlanDelegated(plan.id, byRef.id) ?? {
            ...plan,
            status: 'delegated' as const,
            targetWorkItemId: byRef.id,
          }
    return success(byRef, syncedPlan, true)
  }

  if (plan.status === 'delegated') {
    return fail('mark_delegated_failed', 'Delegation plan is delegated but WorkItem reference is missing.')
  }

  return null
}

function assertEmployeeActive(employeeId: string): DelegationExecutionFailure | null {
  const profile = getEmployee(employeeId)
  if (!profile) {
    return fail('employee_not_found', `Employee ${employeeId} is not registered.`)
  }
  if (profile.availability !== 'active') {
    return fail(
      'employee_inactive',
      `${profile.displayName} is not available for delegated work.`,
    )
  }
  return null
}

function assertTaskPresent(plan: DelegationPlanRecord): DelegationExecutionFailure | null {
  if (!plan.taskTitle.trim() || !plan.taskText.trim()) {
    return fail('task_missing', 'Delegation plan has no task title or description.')
  }
  return null
}

export function executeApprovedDelegationPlan(planId: string): DelegationExecutionResult {
  const plan = getDelegationPlan(planId)
  if (!plan) {
    return fail('plan_not_found', `Delegation plan ${planId} was not found.`)
  }

  const existing = resolveExistingExecution(plan)
  if (existing) return existing

  if (plan.status !== 'approved') {
    return fail(
      'not_approved',
      `Delegation plan must be approved before execution (current: ${plan.status}).`,
    )
  }

  const employeeError = assertEmployeeActive(plan.recommendedEmployeeId)
  if (employeeError) return employeeError

  const taskError = assertTaskPresent(plan)
  if (taskError) return taskError

  const workItem = createEmployeeWorkItem({
    companyId: plan.companyId,
    employeeId: plan.recommendedEmployeeId,
    title: plan.taskTitle,
    taskText: plan.taskText,
    summary: plan.ownerExplanation,
    priority: 'medium',
    structuredPayload: buildDelegationWorkItemStructuredPayload(plan),
    source: 'delegation',
    delegationPlanId: plan.id,
  })

  const delegatedPlan = markDelegationPlanDelegated(plan.id, workItem.id)
  if (!delegatedPlan) {
    return fail('mark_delegated_failed', 'Could not mark delegation plan as delegated.')
  }

  return success(workItem, delegatedPlan, false)
}
