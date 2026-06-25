import { useCallback, useEffect, useState } from 'react'
import {
  createWorkspace,
  getWorkspaceById,
  loadWorkspaces,
  updateWorkspace,
  type CreateWorkspaceInput,
  type Workspace,
} from '../domain/workspaces/workspace'

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspaces())

  const refresh = useCallback(() => {
    setWorkspaces(loadWorkspaces())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-workspaces') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const create = useCallback((input: CreateWorkspaceInput): Workspace => {
    const created = createWorkspace(input)
    setWorkspaces(loadWorkspaces())
    return created
  }, [])

  const update = useCallback(
    (id: string, patch: Parameters<typeof updateWorkspace>[1]): Workspace | null => {
      const updated = updateWorkspace(id, patch)
      setWorkspaces(loadWorkspaces())
      return updated
    },
    [],
  )

  const getById = useCallback((id: string): Workspace | null => {
    return getWorkspaceById(id)
  }, [])

  return { workspaces, create, update, getById, refresh }
}
