import { useMemo } from 'react'
import {
  getModelById,
  getProviderForModel,
  selectModelForTask,
  type ModelSelection,
  type RuntimeProfile,
  type TaskContext,
} from '../domain/runtime/runtimeStorage'

export function useModelRouter(profile: RuntimeProfile | null, taskContext: TaskContext) {
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

  return { selection, selectedModel, selectedProvider }
}

export { selectModelForTask } from '../domain/runtime/runtimeStorage'
export type { ModelSelection, TaskContext } from '../domain/runtime/runtimeStorage'
