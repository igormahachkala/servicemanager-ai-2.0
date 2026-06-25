export const RUNTIME_RUN_STATES = [
  'queued',
  'preparing_context',
  'waiting_approval',
  'running',
  'completed',
  'cancelled',
  'failed',
] as const

export type RuntimeRunState = (typeof RUNTIME_RUN_STATES)[number]

export function isTerminalRunState(state: RuntimeRunState): boolean {
  return state === 'completed' || state === 'cancelled' || state === 'failed'
}

export function isActiveRunState(state: RuntimeRunState): boolean {
  return !isTerminalRunState(state)
}

export type RuntimePipelineStepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'failed'

export type RuntimePipelineStep = {
  id: string
  order: number
  status: RuntimePipelineStepStatus
  detail?: string
}
