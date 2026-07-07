import type { DecisionPlan } from '../decisionPlan'
import { buildDecisionPlan } from '../decisionStrategy'
import { getOrCreateRuntimeProfile } from '../runtime/runtimeStorage'
import type { EmployeeBrainProfile, EmployeeBrainTaskInput } from './employeeBrainProfile'
import { buildDefaultEmployeeBrainProfile } from './employeeBrainCatalog'

export type BuildEmployeeBrainDecisionPlanInput = {
  profile?: EmployeeBrainProfile | null
  task: EmployeeBrainTaskInput
}

/**
 * Brain entry point: after receiving a task, produce a Decision Plan.
 * Does not invoke Runtime, LLM, or tools.
 */
export function buildEmployeeBrainDecisionPlan(
  input: BuildEmployeeBrainDecisionPlanInput,
): DecisionPlan {
  const employeeId = input.profile?.employeeId ?? 'ag-max'
  const profile = input.profile ?? buildDefaultEmployeeBrainProfile(employeeId)
  const runtimeProfile = getOrCreateRuntimeProfile(employeeId)

  return buildDecisionPlan({
    brain: profile,
    task: input.task,
    runtimeProfile,
  })
}
