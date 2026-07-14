/**
 * Cursor Automation Runner — metadata persistence helpers (AI-COMPANY-113).
 */

import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { buildResultMarkerPath, buildBranchPrefix } from './cursorAutomationInstruction'
import { buildBusinessIdempotencyKey } from './cursorAutomationPayload'
import type {
  CursorAutomationExecutionAttempt,
  CursorAutomationRunnerMetadata,
} from './cursorAutomationRunnerTypes'
import { CURSOR_AUTOMATION_RUNNER_VERSION } from './cursorAutomationRunnerTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function buildInitialRunnerMetadata(input: {
  repository: string
  baseBranch: string
  environment?: 'dev'
}): CursorAutomationRunnerMetadata {
  return {
    version: CURSOR_AUTOMATION_RUNNER_VERSION,
    repository: input.repository,
    baseBranch: input.baseBranch,
    environment: input.environment ?? 'dev',
    idempotencyKey: '',
    dispatchPhase: 'DISPATCHING',
    ownerApprovedAt: null,
    dispatchedAt: null,
    reconciliationStartedAt: null,
    reconciliationLastCheckedAt: null,
    reconciliationPollCount: 0,
    resultMarkerPath: '',
    branchPrefix: buildBranchPrefix(),
    attempts: [],
    timeoutAt: null,
    timeoutReason: null,
  }
}

export function readCursorAutomationRunnerMetadata(
  run: ToolExecutionRun,
): CursorAutomationRunnerMetadata | null {
  const output = run.result?.output
  if (!isRecord(output)) return null
  const raw = output.cursorAutomationRunner
  if (!isRecord(raw)) return null
  if (raw.version !== CURSOR_AUTOMATION_RUNNER_VERSION) return null
  return raw as unknown as CursorAutomationRunnerMetadata
}

export function mergeRunOutputWithRunner(
  run: ToolExecutionRun,
  metadata: CursorAutomationRunnerMetadata,
  extra: Record<string, unknown> = {},
  preservePlannedOnly = false,
): ToolExecutionRun['result'] {
  const existingOutput = run.result?.output ?? {}
  return {
    plannedOnly: preservePlannedOnly ? (run.result?.plannedOnly ?? false) : false,
    output: {
      ...existingOutput,
      ...extra,
      cursorAutomationRunner: metadata,
    },
    deliveryMode: run.result?.deliveryMode ?? 'cursor_v1',
    cursorAutomationTaskId: run.result?.cursorAutomationTaskId ?? null,
    registryInvokePlanId: run.result?.registryInvokePlanId ?? null,
    receivedAt: run.result?.receivedAt ?? null,
  }
}

export function patchRunnerMetadata(
  run: ToolExecutionRun,
  patch: Partial<CursorAutomationRunnerMetadata>,
  extra: Record<string, unknown> = {},
): ToolExecutionRun {
  const existing =
    readCursorAutomationRunnerMetadata(run) ??
    buildInitialRunnerMetadata({
      repository: patch.repository ?? 'unknown',
      baseBranch: patch.baseBranch ?? 'main',
      environment: patch.environment ?? 'dev',
    })

  const next: CursorAutomationRunnerMetadata = {
    ...existing,
    ...patch,
    attempts: patch.attempts ?? existing.attempts,
    resultMarkerPath:
      patch.resultMarkerPath ??
      (existing.resultMarkerPath || buildResultMarkerPath(run.id)),
    idempotencyKey:
      patch.idempotencyKey ??
      (existing.idempotencyKey || buildBusinessIdempotencyKey(run.id)),
  }

  return {
    ...run,
    result: mergeRunOutputWithRunner(run, next, extra),
    updatedAt: new Date().toISOString(),
  }
}

export function findSuccessfulDispatchAttempt(
  metadata: CursorAutomationRunnerMetadata,
): CursorAutomationExecutionAttempt | null {
  return (
    metadata.attempts.find(
      (attempt) =>
        attempt.transportStatus === 'DISPATCHED' && Boolean(attempt.backgroundComposerId),
    ) ?? null
  )
}

export function hasBusinessEnqueueAttempt(metadata: CursorAutomationRunnerMetadata): boolean {
  const businessKey = metadata.idempotencyKey || ''
  return metadata.attempts.some(
    (attempt) =>
      attempt.idempotencyKey === businessKey && attempt.transportStatus === 'DISPATCHED',
  )
}

export function nextAttemptNumber(metadata: CursorAutomationRunnerMetadata): number {
  return metadata.attempts.length + 1
}

export function createAttemptId(runId: string, attemptNumber: number): string {
  return `caa-${runId}-${attemptNumber}`
}
