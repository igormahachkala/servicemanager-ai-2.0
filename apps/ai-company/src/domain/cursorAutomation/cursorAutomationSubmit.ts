/**
 * Cursor Automation Submit Pipeline (AI-COMPANY-099A).
 * Controlled handoff after Owner Approval — no shell/git; Cursor API only via future adapter.
 */

import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import { getCursorAutomationOwnerApprovalByLoopId } from './cursorAutomationOwnerApproval'
import { buildCursorAutomationExpectedResult } from './cursorAutomationMockIngestion'
import {
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
  type CursorAutomationWorkflowSnapshot,
} from './cursorAutomationTypes'
import type {
  CursorAutomationHandoffPayload,
  CursorAutomationSubmitRun,
} from './cursorAutomationSubmitRun'
import {
  getCursorAutomationSubmitRunByLoopId,
  upsertCursorAutomationSubmitRun,
} from './cursorAutomationSubmitStorage'
import { upsertCursorAutomationRun } from './cursorAutomationStorage'
import { CURSOR_AUTOMATION_TOOL_ID, type CursorAutomationTask } from './cursorAutomation'

const CURSOR_API_CONFIG_STORAGE_KEY = 'ai-company-cursor-api-adapter-config'

export type CursorAutomationSubmitEligibility = {
  canSubmit: boolean
  reasons: string[]
}

export type CursorAutomationSubmitResult = {
  ok: boolean
  run: CursorAutomationSubmitRun | null
  errorMessage: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function createSubmitRunId(): string {
  return `car-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * V1: adapter is connected only when Owner explicitly enabled config in localStorage.
 * No network probe — production adapter will replace this gate.
 */
export function isCursorAutomationApiAdapterAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(CURSOR_API_CONFIG_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return false
    return (parsed as Record<string, unknown>).enabled === true
  } catch {
    return false
  }
}

function assertSafeModeForSubmit(loop: MaxWorkerLoopRecord): string | null {
  if (!loop.safeMode) {
    return 'Safe mode отключён — submit заблокирован до явного Owner policy (V2).'
  }
  return null
}

export function evaluateCursorAutomationSubmitEligibility(input: {
  loop: MaxWorkerLoopRecord
  cursorAutomation: CursorAutomationWorkflowSnapshot
}): CursorAutomationSubmitEligibility {
  const reasons: string[] = []
  const { loop, cursorAutomation: ca } = input

  if (ca.ownerApprovalStatus !== 'approved') {
    reasons.push('Owner Approval не одобрен.')
  }

  if (ca.status !== 'ready_for_cursor_automation') {
    reasons.push(`Статус tool branch: ${ca.status} — требуется ready_for_cursor_automation.`)
  }

  if (!ca.handoff?.promptMarkdown?.trim()) {
    reasons.push('Handoff prompt отсутствует.')
  }

  const expectedResult =
    ca.expectedResult ??
    (ca.handoff?.plan ? buildCursorAutomationExpectedResult(ca.handoff.plan) : null)

  if (!expectedResult) {
    reasons.push('Expected result не сформирован.')
  }

  if (!ca.plan?.goal?.trim()) {
    reasons.push('План Cursor Automation без цели (goal).')
  }

  const safeModeBlock = assertSafeModeForSubmit(loop)
  if (safeModeBlock) {
    reasons.push(safeModeBlock)
  }

  const existing = getCursorAutomationSubmitRunByLoopId(loop.id)
  if (existing && existing.status !== 'failed') {
    reasons.push(`Submit уже выполнен (runId: ${existing.runId}).`)
  }

  return { canSubmit: reasons.length === 0, reasons }
}

function buildHandoffPayload(input: {
  loop: MaxWorkerLoopRecord
  snapshot: CursorAutomationWorkflowSnapshot
  ownerApprovalId: string
}): CursorAutomationHandoffPayload | null {
  const handoff = input.snapshot.handoff
  if (!handoff?.promptMarkdown?.trim()) return null

  const expectedResult =
    input.snapshot.expectedResult ?? buildCursorAutomationExpectedResult(handoff.plan)

  return {
    handoffId: handoff.handoffId,
    promptMarkdown: handoff.promptMarkdown,
    plan: handoff.plan,
    expectedResult,
    metadata: {
      maxWorkerLoopId: input.loop.id,
      runtimeRunId: input.loop.runtimeRunId,
      ownerApprovalId: input.ownerApprovalId,
      employeeId: input.loop.employeeId,
      submittedBy: 'owner',
      workflowVersion: CURSOR_AUTOMATION_WORKFLOW_VERSION,
    },
  }
}

function mirrorCursorAutomationTask(run: CursorAutomationSubmitRun): CursorAutomationTask {
  const payload = run.handoffPayload
  const now = nowIso()

  const task: CursorAutomationTask = {
    id: run.runId,
    title: payload.plan.expectedPullRequest.title,
    instructions: payload.promptMarkdown,
    trigger: {
      kind: 'runtime-handoff',
      runtimeRunId: run.runtimeRunId ?? '',
      maxWorkerLoopId: run.maxWorkerLoopId,
      employeeId: payload.metadata.employeeId,
    },
    requestedByEmployeeId: payload.metadata.employeeId,
    runtimeRunId: run.runtimeRunId,
    maxWorkerLoopId: run.maxWorkerLoopId,
    projectId: null,
    workspaceId: null,
    repository: {
      owner: 'igor',
      repo: payload.plan.repository.split('/').pop() ?? 'servicemanager-ai-2.0',
      branch: payload.plan.workingBranch,
    },
    enabledTools: ['github', 'filesystem'],
    status: run.adapterConnected ? 'queued' : 'planned',
    requiresOwnerApproval: false,
    toolRegistryV1Id: CURSOR_AUTOMATION_TOOL_ID,
    createdAt: run.createdAt,
    updatedAt: now,
  }

  return upsertCursorAutomationRun(task)
}

/**
 * Submit handoff to Cursor Automation pipeline.
 * V1: persists payload locally; does not call external services.
 */
export function submitToCursorAutomation(input: {
  loop: MaxWorkerLoopRecord
  cursorAutomation: CursorAutomationWorkflowSnapshot
}): CursorAutomationSubmitResult {
  const eligibility = evaluateCursorAutomationSubmitEligibility(input)
  if (!eligibility.canSubmit) {
    return {
      ok: false,
      run: null,
      errorMessage: eligibility.reasons.join(' '),
    }
  }

  const approval = getCursorAutomationOwnerApprovalByLoopId(input.loop.id)
  if (!approval || approval.status !== 'approved') {
    return { ok: false, run: null, errorMessage: 'Owner Approval record не найден или не approved.' }
  }

  const handoffPayload = buildHandoffPayload({
    loop: input.loop,
    snapshot: input.cursorAutomation,
    ownerApprovalId: approval.id,
  })

  if (!handoffPayload) {
    return { ok: false, run: null, errorMessage: 'Не удалось собрать handoff payload.' }
  }

  const adapterConnected = isCursorAutomationApiAdapterAvailable()
  const now = nowIso()
  const previous = getCursorAutomationSubmitRunByLoopId(input.loop.id)

  const run: CursorAutomationSubmitRun = {
    runId: createSubmitRunId(),
    maxWorkerLoopId: input.loop.id,
    runtimeRunId: input.loop.runtimeRunId,
    ownerApprovalId: approval.id,
    handoffId: handoffPayload.handoffId,
    status: adapterConnected ? 'submitted_pending_real_adapter' : 'submitted_mock',
    deliveryMode: adapterConnected ? 'pending_real_adapter' : 'mock_v1_stub',
    adapterConnected,
    submittedAt: now,
    handoffPayload,
    expectedChecks: handoffPayload.plan.requiredChecks,
    errorMessage: null,
    retryCount: previous?.status === 'failed' ? (previous.retryCount ?? 0) + 1 : 0,
    createdAt: now,
    updatedAt: now,
  }

  const saved = upsertCursorAutomationSubmitRun(run)

  mirrorCursorAutomationTask(saved)

  return { ok: true, run: saved, errorMessage: null }
}

export function mapSubmitRunToWorkflowStatus(
  submitRun: CursorAutomationSubmitRun | null,
): CursorAutomationWorkflowSnapshot['status'] | null {
  if (!submitRun) return null

  switch (submitRun.status) {
    case 'submitted_mock':
      return 'submitted_mock'
    case 'submitted_pending_real_adapter':
      return 'submitted_pending_real_adapter'
    case 'waiting_for_result':
      return 'waiting_for_result'
    case 'failed':
      return 'submit_failed'
    case 'completed':
      return 'mock_result_ready'
    default:
      return null
  }
}
