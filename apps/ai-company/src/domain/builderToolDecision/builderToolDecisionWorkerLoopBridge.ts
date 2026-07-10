/**
 * Builder Worker Loop — tool decision branch after Decision Plan (AI-COMPANY-113B).
 */

import type { DecisionPlan } from '../decisionPlan'
import type { WorkItem } from '../employeeWorkQueue'
import type { MaxWorkerLoopRecord } from '../maxWorkerLoop'
import { updateMaxWorkerLoopPhase, upsertMaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoopStorage'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import { evaluateBuilderToolDecision, isBuilderToolDecisionEmployee } from './builderToolDecisionEngine'
import { submitBuilderCursorToolRequest } from './builderToolRequestBridge'
import type { BuilderToolExecutionRun } from './builderToolDecisionTypes'

export type BuilderToolDecisionWorkerLoopOutcome = {
  handled: boolean
  loop: MaxWorkerLoopRecord
  executionRun: BuilderToolExecutionRun | null
  message: string | null
}

function markBuilderAwaitingOwnerToolApproval(
  record: MaxWorkerLoopRecord,
  message: string,
): MaxWorkerLoopRecord {
  let next = updateMaxWorkerLoopPhase(
    record,
    'tool_need_check',
    'done',
    'Builder: требуется Cursor для изменения кода',
  )
  next = updateMaxWorkerLoopPhase(next, 'owner_approval', 'active', message)
  for (const phase of ['tool_registry', 'verification', 'ollama_reasoning', 'analysis', 'plan', 'runtime_report'] as const) {
    next = updateMaxWorkerLoopPhase(next, phase, 'skipped', 'Ожидание Owner — Cursor не запускался')
  }
  next = updateMaxWorkerLoopPhase(
    next,
    'max_intake',
    'done',
    'Builder подготовил запрос на Cursor',
  )
  const finishedAt = new Date().toISOString()
  next = {
    ...next,
    status: 'waiting_approval',
    currentPhase: 'owner_approval',
    errorMessage: null,
    finishedAt,
    updatedAt: finishedAt,
  }
  return upsertMaxWorkerLoopRecord(next)
}

export function handleBuilderToolDecisionAfterPlan(input: {
  employeeId: string
  loop: MaxWorkerLoopRecord
  decisionPlan: DecisionPlan
  workItem: WorkItem | null
}): BuilderToolDecisionWorkerLoopOutcome {
  if (!isBuilderToolDecisionEmployee(input.employeeId)) {
    return { handled: false, loop: input.loop, executionRun: null, message: null }
  }
  if (input.employeeId !== BUILDER_EMPLOYEE_ID) {
    return { handled: false, loop: input.loop, executionRun: null, message: null }
  }

  const workItem = input.workItem
  if (!workItem) {
    return { handled: false, loop: input.loop, executionRun: null, message: null }
  }

  const decision = evaluateBuilderToolDecision({
    employeeId: input.employeeId,
    workItemId: workItem.id,
    workerLoopId: input.loop.id,
    decisionPlanId: input.decisionPlan.id,
    taskText: workItem.taskText?.trim() || workItem.title,
    title: workItem.title,
    structuredPayload: workItem.structuredPayload,
    decisionPlan: input.decisionPlan,
    expectedOutput: input.loop.input.expectedOutput ?? null,
  })

  if (!decision.toolRequired || decision.recommendedToolId !== 'cursor') {
    return { handled: false, loop: input.loop, executionRun: null, message: null }
  }

  const { executionRun } = submitBuilderCursorToolRequest({
    decision,
    taskTitle: workItem.title,
    projectId: workItem.projectId,
    workspaceId: workItem.workspaceId,
    workerLoopId: input.loop.id,
  })

  const message =
    'Builder подготовил запрос на использование Cursor и ждёт решения Owner.'
  const loop = markBuilderAwaitingOwnerToolApproval(input.loop, message)

  return { handled: true, loop, executionRun, message }
}
