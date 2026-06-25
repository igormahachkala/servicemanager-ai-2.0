import { useMemo } from 'react'
import {
  getActiveRuntimeProviderId,
  getRuntimeProvider,
  initializeRuntimeProviders,
} from '../domain/runtime/providers/runtimeAdapter'
import {
  getModelById,
  getProviderForModel,
  selectModelForTask,
  type ModelSelection,
  type RuntimeProfile,
  type TaskContext,
} from '../domain/runtime/runtimeStorage'

export function useModelRouter(profile: RuntimeProfile | null, taskContext: TaskContext) {
  initializeRuntimeProviders()

  const selection = useMemo<ModelSelection | null>(() => {
    if (!profile) return null
    return selectModelForTask(profile, taskContext)
  }, [profile, taskContext])

  const selectedModel = useMemo(
    () => (selection ? getModelById(selection.selectedModelId) : null),
    [selection],
  )

  const selectedProvider = useMemo(
    () => (selection ? getProviderForModel(selection.selectedModelId) : null),
    [selection],
  )

  const executionProviderId = useMemo(() => getActiveRuntimeProviderId(), [])
  const executionProvider = useMemo(
    () => getRuntimeProvider(executionProviderId),
    [executionProviderId],
  )

  return {
    selection,
    selectedModel,
    selectedProvider,
    executionProviderId,
    executionProvider,
  }
}

export { selectModelForTask } from '../domain/runtime/runtimeStorage'
export type { ModelSelection, TaskContext } from '../domain/runtime/runtimeStorage'
