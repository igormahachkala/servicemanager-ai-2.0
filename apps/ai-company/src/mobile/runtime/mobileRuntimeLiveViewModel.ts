/**
 * Mobile Runtime Live — Owner-visible Worker Loop steps (AI-COMPANY-107L).
 */

import { getRuntimeRunById } from '../../domain/runtime/runtimeOrchestrator'
import type { MaxWorkerLoopPhase, MaxWorkerLoopPhaseProgress, MaxWorkerLoopRecord } from '../../domain/maxWorkerLoop'
import { MAX_WORKER_EMPLOYEE_ID, MAX_WORKER_LOOP_STATUS_LABELS_RU } from '../../domain/maxWorkerLoop'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop/maxWorkerLoopStorage'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  inferRuntimeFailureHint,
  type RuntimeFailureDiagnostics,
  type RuntimeFailureHint,
} from '../../domain/runtime/runtimeFailureDiagnostics'
import { mobileReportHref } from '../navigation/mobileHrefResolver'

export const MOBILE_RUNTIME_LIVE_STEP_IDS = [
  'owner_task',
  'decision_plan',
  'consult_peer',
  'reasoning',
  'runtime',
  'journal',
  'report',
] as const

export type MobileRuntimeLiveStepId = (typeof MOBILE_RUNTIME_LIVE_STEP_IDS)[number]

export type MobileRuntimePhaseStatus = 'pending' | 'running' | 'completed' | 'failed'

export type MobileRuntimeLiveStepView = {
  id: MobileRuntimeLiveStepId
  status: MobileRuntimePhaseStatus
  detail: string | null
  completedAt: string | null
  modelLabel: string | null
  durationMs: number | null
  errorMessage: string | null
}

export type MobileRuntimeLiveView = {
  loop: MaxWorkerLoopRecord
  taskTitle: string
  taskText: string
  loopStatusLabel: string
  isLive: boolean
  currentStepId: MobileRuntimeLiveStepId | null
  steps: MobileRuntimeLiveStepView[]
  progressPercent: number
  elapsedMs: number | null
  modelLabel: string | null
  loopError: string | null
  reportHref: string | null
  failureDiagnostics: RuntimeFailureDiagnostics | null
  failureHint: RuntimeFailureHint
}

const DOMAIN_PHASES_BY_STEP: Record<MobileRuntimeLiveStepId, MaxWorkerLoopPhase[]> = {
  owner_task: ['owner_task', 'max_intake'],
  decision_plan: ['decision_plan', 'model_selection'],
  consult_peer: ['consult_peer'],
  reasoning: ['analysis', 'ollama_reasoning', 'plan'],
  runtime: ['tool_need_check', 'owner_approval', 'tool_registry', 'verification'],
  journal: ['runtime_report', 'memory_evolution_draft', 'knowledge_candidate_draft'],
  report: ['next_actions'],
}

function mapDomainPhaseStatus(progresses: MaxWorkerLoopPhaseProgress[]): MobileRuntimePhaseStatus {
  if (progresses.length === 0) return 'pending'
  if (progresses.some((item) => item.status === 'failed')) return 'failed'
  if (progresses.some((item) => item.status === 'active')) return 'running'
  if (progresses.every((item) => item.status === 'done' || item.status === 'skipped')) return 'completed'
  if (progresses.some((item) => item.status === 'done')) return 'running'
  return 'pending'
}

function pickDetail(progresses: MaxWorkerLoopPhaseProgress[]): string | null {
  const withDetail = [...progresses].reverse().find((item) => item.detail?.trim())
  return withDetail?.detail?.trim() ?? null
}

function pickCompletedAt(progresses: MaxWorkerLoopPhaseProgress[]): string | null {
  const times = progresses.map((item) => item.completedAt).filter((item): item is string => Boolean(item))
  if (times.length === 0) return null
  return times.sort().at(-1) ?? null
}

function phaseDurationMs(progresses: MaxWorkerLoopPhaseProgress[]): number | null {
  const completed = pickCompletedAt(progresses)
  if (!completed) return null
  return null
}

function resolveModelLabel(loop: MaxWorkerLoopRecord): string | null {
  const plan = loop.decisionPlan
  if (plan?.primaryModel?.label?.trim()) return plan.primaryModel.label.trim()
  if (plan?.primaryModel?.ollamaTag?.trim()) return plan.primaryModel.ollamaTag.trim()
  if (loop.runtimeRunId) {
    const run = getRuntimeRunById(loop.runtimeRunId)
    const tag = run?.result?.resolvedOllamaTag ?? run?.result?.ollamaModelTag
    if (tag?.trim()) return tag.trim()
  }
  return null
}

function stepModelLabel(stepId: MobileRuntimeLiveStepId, loop: MaxWorkerLoopRecord): string | null {
  if (stepId === 'decision_plan' || stepId === 'reasoning' || stepId === 'runtime') {
    return resolveModelLabel(loop)
  }
  return null
}

function stepError(
  stepId: MobileRuntimeLiveStepId,
  status: MobileRuntimePhaseStatus,
  loop: MaxWorkerLoopRecord,
): string | null {
  if (status !== 'failed') return null
  if (loop.errorMessage?.trim()) return loop.errorMessage.trim()
  const phases = loop.phases.filter((item) => DOMAIN_PHASES_BY_STEP[stepId].includes(item.phase))
  const failed = phases.find((item) => item.status === 'failed')
  return failed?.detail?.trim() ?? null
}

export function findActiveMaxWorkerLoop(): MaxWorkerLoopRecord | null {
  return (
    loadMaxWorkerLoopRecords().find(
      (record) =>
        record.employeeId === MAX_WORKER_EMPLOYEE_ID &&
        (record.status === 'running' ||
          record.status === 'queued' ||
          record.status === 'waiting_approval'),
    ) ?? null
  )
}

export function findActiveEmployeeWorkerLoop(employeeId: string): MaxWorkerLoopRecord | null {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  return (
    loadMaxWorkerLoopRecords().find(
      (record) =>
        record.employeeId === canonical &&
        (record.status === 'running' ||
          record.status === 'queued' ||
          record.status === 'waiting_approval'),
    ) ?? null
  )
}

export function resolveMobileRuntimeLoop(loopId: string | null, runtimeRunId: string | null): MaxWorkerLoopRecord | null {
  if (loopId) {
    return loadMaxWorkerLoopRecords().find((record) => record.id === loopId) ?? null
  }
  if (runtimeRunId) {
    return loadMaxWorkerLoopRecords().find((record) => record.runtimeRunId === runtimeRunId) ?? null
  }
  return findActiveMaxWorkerLoop() ?? loadMaxWorkerLoopRecords()[0] ?? null
}

export function buildMobileRuntimeLiveView(loop: MaxWorkerLoopRecord): MobileRuntimeLiveView {
  const steps: MobileRuntimeLiveStepView[] = MOBILE_RUNTIME_LIVE_STEP_IDS.map((stepId) => {
    const progresses = loop.phases.filter((item) => DOMAIN_PHASES_BY_STEP[stepId].includes(item.phase))
    const status = mapDomainPhaseStatus(progresses)
    return {
      id: stepId,
      status,
      detail: pickDetail(progresses),
      completedAt: pickCompletedAt(progresses),
      modelLabel: stepModelLabel(stepId, loop),
      durationMs: phaseDurationMs(progresses),
      errorMessage: stepError(stepId, status, loop),
    }
  })

  const currentStepId =
    steps.find((item) => item.status === 'running' || item.status === 'failed')?.id ??
    (loop.status === 'completed' ? 'report' : steps.find((item) => item.status === 'pending')?.id ?? null)

  const completedCount = steps.filter((item) => item.status === 'completed').length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  const startedAt = Date.parse(loop.createdAt)
  const endedAt = loop.finishedAt ? Date.parse(loop.finishedAt) : Date.parse(loop.updatedAt)
  const elapsedMs =
    !Number.isNaN(startedAt) && !Number.isNaN(endedAt) ? Math.max(0, endedAt - startedAt) : null

  const reportHref = loop.reportId ? mobileReportHref(`runtime:${loop.reportId}`) : null

  const failureDiagnostics =
    loop.failureDiagnostics ??
    (loop.runtimeRunId ? getRuntimeRunById(loop.runtimeRunId)?.failureDiagnostics ?? null : null)

  const loopError = failureDiagnostics?.errorMessage ?? loop.errorMessage

  return {
    loop,
    taskTitle: loop.input.title?.trim() || loop.input.taskText.slice(0, 120),
    taskText: loop.input.taskText,
    loopStatusLabel: MAX_WORKER_LOOP_STATUS_LABELS_RU[loop.status],
    isLive:
      loop.status === 'running' ||
      loop.status === 'queued' ||
      loop.status === 'waiting_approval',
    currentStepId,
    steps,
    progressPercent,
    elapsedMs,
    modelLabel: resolveModelLabel(loop),
    loopError,
    reportHref,
    failureDiagnostics,
    failureHint: inferRuntimeFailureHint(failureDiagnostics),
  }
}
