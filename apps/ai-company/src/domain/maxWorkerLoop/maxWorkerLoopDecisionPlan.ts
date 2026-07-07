/**
 * MAX Worker Loop — Decision Plan phase (AI-COMPANY-102B).
 * Bridges Employee Brain → DecisionPlan before Runtime / Ollama.
 */

import type { DecisionPlan } from '../decisionPlan'
import { buildEmployeeBrainDecisionPlan } from '../employeeBrain/employeeBrainDecision'
import type { RuntimeModelMode } from '../runtime/runtimeModelRouting'
import type { MaxWorkerLoopInput, MaxWorkerLoopRecord } from './maxWorkerLoop'
import { MAX_WORKER_EMPLOYEE_ID } from './maxWorkerLoop'

export function buildMaxWorkerLoopDecisionPlan(input: {
  loop: Pick<MaxWorkerLoopRecord, 'input' | 'deliveryTaskId'>
  requestedModelMode?: MaxWorkerLoopInput['modelMode'] | null
}): DecisionPlan {
  return buildEmployeeBrainDecisionPlan({
    task: {
      taskText: input.loop.input.taskText,
      title: input.loop.input.title ?? null,
      taskId: input.loop.deliveryTaskId,
      projectId: input.loop.input.projectId,
      workspaceId: input.loop.input.workspaceId,
      requestedModelMode: input.requestedModelMode ?? input.loop.input.modelMode ?? 'coding',
    },
  })
}

export function resolveModelModeFromDecisionPlan(plan: DecisionPlan): RuntimeModelMode {
  return plan.primaryModel.modelMode
}

export function summarizeDecisionPlanPhase(plan: DecisionPlan): string {
  const tools = plan.cursorAutomationRequired
    ? 'Cursor'
    : plan.toolRegistryRequired
      ? plan.suggestedToolIds.join(', ')
      : 'без инструментов'
  const approval = plan.ownerApprovalRequired ? ' · Owner Approval' : ''
  const peer =
    plan.peerConsultation.required && plan.peerConsultation.peerDisplayName
      ? ` · consult ${plan.peerConsultation.peerDisplayName}`
      : ''
  return `Intent: ${plan.classifiedIntent} · ${plan.primaryModel.label} · ${tools}${approval}${peer}`
}

export function summarizeModelSelectionPhase(plan: DecisionPlan): string {
  const pipeline = plan.useMultipleModels
    ? plan.modelPipeline.map((item) => item.ollamaTag).join(' → ')
    : plan.primaryModel.ollamaTag
  return `${pipeline} (${plan.primaryModel.modelMode})`
}

export function decisionPlanEmployeeId(): typeof MAX_WORKER_EMPLOYEE_ID {
  return MAX_WORKER_EMPLOYEE_ID
}
