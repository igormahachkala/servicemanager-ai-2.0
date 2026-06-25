export type RuntimeContextLayerKey =
  | 'employee_profile'
  | 'memory'
  | 'knowledge'
  | 'competencies'
  | 'workspace'
  | 'permissions'
  | 'tools'
  | 'conversation'
  | 'current_task'
  | 'runtime_profile'

export type RuntimeContextLayer = {
  key: RuntimeContextLayerKey
  loaded: boolean
  itemCount: number
  summary: string
}

export type RuntimeContext = {
  employeeId: string
  workspaceId: string | null
  taskId: string | null
  chatId: string | null
  layers: RuntimeContextLayer[]
  builtAt: string
}

export const RUNTIME_CONTEXT_LAYER_ORDER: RuntimeContextLayerKey[] = [
  'employee_profile',
  'memory',
  'knowledge',
  'competencies',
  'workspace',
  'permissions',
  'tools',
  'conversation',
  'current_task',
  'runtime_profile',
]
