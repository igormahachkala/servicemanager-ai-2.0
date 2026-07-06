import {
  buildAutonomousDemoPanelSteps,
  pickAutonomousDemoCurrentStep,
  type AutonomousDemoUiStepId,
} from './autonomousDemoPhaseGuide'
import type { MaxWorkerLoopPhaseProgress, MaxWorkerLoopRecord } from './maxWorkerLoop'
import { MAX_WORKER_LOOP_STATUS_LABELS_RU } from './maxWorkerLoop'
import {
  MAX_WORKER_LOOP_PHASE_GUIDE_RU,
  MAX_WORKER_LOOP_UI_STEP_IDS,
  domainPhasesForUiStep,
  type MaxWorkerLoopUiStepId,
} from './maxWorkerLoopPhaseGuide'
import type { MaxWorkerLoopSnapshot } from './maxWorkerLoopEngine'

export type MaxWorkerLoopUiStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed'

export type MaxWorkerLoopUiStepView = {
  id: MaxWorkerLoopUiStepId | AutonomousDemoUiStepId
  label: string
  status: MaxWorkerLoopUiStepStatus
  completedAt: string | null
  description: string | null
  whatHappens: string
  whatNext: string
  insight: string | null
}

export type MaxWorkerLoopPanelView = {
  loop: MaxWorkerLoopRecord
  statusLabel: string
  currentStepId: MaxWorkerLoopUiStepId | AutonomousDemoUiStepId | null
  steps: MaxWorkerLoopUiStepView[]
  errorMessage: string | null
  isAutonomousDemo?: boolean
}

function aggregatePhaseStatus(
  progresses: MaxWorkerLoopPhaseProgress[],
): MaxWorkerLoopUiStepStatus {
  if (progresses.length === 0) return 'pending'
  if (progresses.some((item) => item.status === 'failed')) return 'failed'
  if (progresses.some((item) => item.status === 'active')) return 'active'
  if (progresses.every((item) => item.status === 'skipped')) return 'skipped'
  if (progresses.every((item) => item.status === 'done' || item.status === 'skipped')) return 'done'
  if (progresses.some((item) => item.status === 'done')) return 'active'
  return 'pending'
}

function pickDescription(progresses: MaxWorkerLoopPhaseProgress[]): string | null {
  const withDetail = [...progresses].reverse().find((item) => item.detail?.trim())
  return withDetail?.detail?.trim() ?? null
}

function pickCompletedAt(progresses: MaxWorkerLoopPhaseProgress[]): string | null {
  const times = progresses.map((item) => item.completedAt).filter((item): item is string => Boolean(item))
  if (times.length === 0) return null
  return times.sort().at(-1) ?? null
}

function buildInsight(
  stepId: MaxWorkerLoopUiStepId,
  snapshot: MaxWorkerLoopSnapshot | null,
): string | null {
  if (!snapshot) return null
  switch (stepId) {
    case 'analysis':
      return snapshot.reasoning.analysis.slice(0, 240) || null
    case 'reasoning':
      return snapshot.reasoning.durationMs != null
        ? `Ollama · ${snapshot.reasoning.durationMs} ms`
        : null
    case 'plan':
      return snapshot.reasoning.plan.length > 0
        ? snapshot.reasoning.plan.slice(0, 3).join(' · ')
        : null
    case 'tool_check': {
      const cursor = snapshot.cursorAutomation
      if (cursor?.externalExecutorRequired) {
        return `Cursor Automation · ${cursor.status} · ${cursor.suggestedToolId ?? '—'}`
      }
      return snapshot.ownerApproval.required
        ? 'Требуется одобрение Owner (V2)'
        : 'Инструмент не требуется — V1 safe mode'
    }
    case 'memory_draft':
      return `${snapshot.memoryEvolutionDraft.lessons.length} уроков · +${snapshot.memoryEvolutionDraft.estimatedExperiencePoints} XP (черновик)`
    case 'knowledge_draft':
      return `${snapshot.knowledgeCandidates.length} кандидатов в Knowledge`
    case 'next_actions':
      return snapshot.nextActions.slice(0, 2).map((item) => item.label).join(' · ') || null
    default:
      return null
  }
}

export function buildMaxWorkerLoopPanelView(
  loop: MaxWorkerLoopRecord,
  snapshot: MaxWorkerLoopSnapshot | null = null,
): MaxWorkerLoopPanelView {
  if (loop.autonomousDemoScenarioId) {
    const steps = buildAutonomousDemoPanelSteps(loop, snapshot)
    return {
      loop,
      statusLabel: MAX_WORKER_LOOP_STATUS_LABELS_RU[loop.status],
      currentStepId: pickAutonomousDemoCurrentStep(steps, loop),
      steps,
      errorMessage: loop.errorMessage,
      isAutonomousDemo: true,
    }
  }

  const steps: MaxWorkerLoopUiStepView[] = MAX_WORKER_LOOP_UI_STEP_IDS.map((stepId) => {
    const domainPhases = domainPhasesForUiStep(stepId)
    const progresses = loop.phases.filter((item) => domainPhases.includes(item.phase))
    const guide = MAX_WORKER_LOOP_PHASE_GUIDE_RU[stepId]

    return {
      id: stepId,
      label: guide.label,
      status: aggregatePhaseStatus(progresses),
      completedAt: pickCompletedAt(progresses),
      description: pickDescription(progresses),
      whatHappens: guide.whatHappens,
      whatNext: guide.whatNext,
      insight: buildInsight(stepId, snapshot),
    }
  })

  const activeStep = steps.find((item) => item.status === 'active' || item.status === 'failed') ?? null
  const currentStepId =
    activeStep?.id ??
    (loop.status === 'completed' ? 'next_actions' : steps.find((item) => item.status === 'pending')?.id ?? null)

  return {
    loop,
    statusLabel: MAX_WORKER_LOOP_STATUS_LABELS_RU[loop.status],
    currentStepId,
    steps,
    errorMessage: loop.errorMessage,
    isAutonomousDemo: false,
  }
}
