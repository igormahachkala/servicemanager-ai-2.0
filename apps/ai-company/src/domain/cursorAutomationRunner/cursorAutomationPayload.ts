/**
 * Cursor Automation — Builder payload contract (AI-COMPANY-113).
 */

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  buildBranchPrefix,
  buildResultMarkerPath,
} from './cursorAutomationInstruction'
import type { BuilderAutomationPayload } from './cursorAutomationRunnerTypes'

const DEFAULT_CONSTRAINTS = [
  'DEV-only — no production deploy',
  'One Task = One Commit',
  'Work only in cursor/* branch',
  'No destructive commands',
] as const

export function buildBusinessIdempotencyKey(runId: string): string {
  return `builder-automation:${runId}:enqueue`
}

export function buildRetryIdempotencyKey(runId: string, attemptNumber: number): string {
  return `builder-automation:${runId}:attempt:${attemptNumber}`
}

export function buildBuilderAutomationPayload(input: {
  run: ToolExecutionRun
  repository: string
  baseBranch: string
  environment?: 'dev'
  constraints?: string[]
  requiredChecks?: string[]
  idempotencyKey: string
}): BuilderAutomationPayload {
  const resultMarkerPath = buildResultMarkerPath(input.run.id)
  const branchPrefix = buildBranchPrefix()

  return {
    toolExecutionRunId: input.run.id,
    taskId: input.run.workItemId,
    employeeId: EMPLOYEE_ROUTE_IDS.builder,
    title: input.run.title,
    instruction: input.run.instructions,
    repository: input.repository,
    baseBranch: input.baseBranch,
    expectedResult: input.run.expectedResult,
    constraints: [...DEFAULT_CONSTRAINTS, ...(input.constraints ?? [])],
    requiredChecks: input.run.checks.length > 0 ? input.run.checks : ['npm --prefix apps/ai-company run build'],
    idempotencyKey: input.idempotencyKey,
    environment: input.environment ?? 'dev',
    callbackHints: {
      resultMarkerPath,
      branchPrefix,
    },
  }
}

export function buildWebhookRequestBody(payload: BuilderAutomationPayload): Record<string, unknown> {
  const instruction = payload.instruction
  return {
    ...payload,
    prompt: instruction,
    text: instruction,
  }
}
