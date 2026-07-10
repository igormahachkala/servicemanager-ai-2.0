/**
 * Map DelegationPlanRecord → WorkItem structured payload (112F).
 */

import type { DelegationPlanRecord } from '../delegationPlan/delegationPlanTypes'
import type { WorkItemStructuredPayload } from '../employeeWorkQueue/workItemStructuredPayload'

export function buildDelegationWorkItemStructuredPayload(
  plan: DelegationPlanRecord,
): WorkItemStructuredPayload {
  return {
    version: 'v1',
    mode: 'complex',
    objective: plan.taskTitle,
    context: plan.ownerExplanation,
    expectedResult: plan.rationale[0] ?? plan.ownerExplanation,
    constraints: plan.matchedSignals.length > 0 ? plan.matchedSignals.join('; ') : null,
  }
}
