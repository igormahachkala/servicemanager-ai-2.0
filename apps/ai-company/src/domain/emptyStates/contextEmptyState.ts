export type ContextEmptyArea =
  | 'taskResults'
  | 'memory'
  | 'knowledge'
  | 'timeline'
  | 'reports'
  | 'runtime'
  | 'workspace'
  | 'canvas'
  | 'approvals'

export type ContextEmptyVariant = 'initial' | 'filtered'

export const CONTEXT_EMPTY_ROUTES: Record<ContextEmptyArea, string> = {
  taskResults: '/ops/run-task',
  memory: '/ops/run-task',
  knowledge: '/ops/run-task',
  timeline: '/ops/run-task',
  reports: '/ops/run-task',
  runtime: '/ops/run-task',
  workspace: '/ops/workspaces/new',
  canvas: '/ops/run-task',
  approvals: '/ops/run-task',
}
