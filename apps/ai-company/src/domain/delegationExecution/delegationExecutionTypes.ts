/**
 * Delegation Execution Bridge — result types (AI-COMPANY-112F).
 */

import type { DelegationPlanRecord } from '../delegationPlan/delegationPlanTypes'
import type { WorkItem } from '../employeeWorkQueue'

export const DELEGATION_EXECUTION_ERROR_CODES = [
  'plan_not_found',
  'not_approved',
  'employee_not_found',
  'employee_inactive',
  'task_missing',
  'mark_delegated_failed',
] as const

export type DelegationExecutionErrorCode = (typeof DELEGATION_EXECUTION_ERROR_CODES)[number]

export type DelegationExecutionSuccess = {
  ok: true
  workItem: WorkItem
  plan: DelegationPlanRecord
  /** True when an existing WorkItem was returned without creating a duplicate. */
  idempotent: boolean
}

export type DelegationExecutionFailure = {
  ok: false
  code: DelegationExecutionErrorCode
  message: string
}

export type DelegationExecutionResult = DelegationExecutionSuccess | DelegationExecutionFailure
