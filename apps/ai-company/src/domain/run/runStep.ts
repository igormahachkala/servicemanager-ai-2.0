export const RUN_STEP_KINDS = [
  'context_loaded',
  'knowledge_loaded',
  'memory_loaded',
  'model_selected',
  'approval_requested',
  'execution_started',
  'execution_finished',
  'report_generated',
  'events_created',
] as const

export type RunStepKind = (typeof RUN_STEP_KINDS)[number]

export const RUN_STEP_STATUSES = ['pending', 'active', 'done', 'skipped', 'failed'] as const

export type RunStepStatus = (typeof RUN_STEP_STATUSES)[number]

export type RunStep = {
  id: string
  kind: RunStepKind
  order: number
  status: RunStepStatus
  detail?: string
  completedAt?: string | null
}

export function createPendingRunSteps(): RunStep[] {
  return RUN_STEP_KINDS.map((kind, index) => ({
    id: `step-${kind}`,
    kind,
    order: index + 1,
    status: 'pending' as const,
  }))
}
