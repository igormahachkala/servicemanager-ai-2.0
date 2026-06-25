import type { RuntimeRunState, RuntimePipelineStep } from './runtimeState'
import type { RuntimeContext } from './runtimeContext'
import type { RuntimeResult } from './runtimeResult'

export type RuntimeRun = {
  id: string
  employeeId: string
  workspaceId: string | null
  runtimeProfileId: string
  modelId: string
  providerId: string
  taskId: string | null
  chatId: string | null
  reportId: string | null
  status: RuntimeRunState
  startedAt: string
  finishedAt: string | null
  context: RuntimeContext
  pipeline: RuntimePipelineStep[]
  result: RuntimeResult | null
}
