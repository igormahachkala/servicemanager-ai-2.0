import { useCallback, useEffect, useState } from 'react'
import {
  createProject,
  ensureSeedProjects,
  getProjectById,
  getProjectsByWorkspaceId,
  loadProjects,
  updateProject,
  type CreateProjectInput,
  type Project,
} from '../domain/projects'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => {
    ensureSeedProjects()
    return loadProjects()
  })

  const refresh = useCallback(() => {
    ensureSeedProjects()
    setProjects(loadProjects())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-projects' || event.key === 'ai-company-projects-seeded') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const create = useCallback((input: CreateProjectInput): Project => {
    const created = createProject(input)
    setProjects(loadProjects())
    return created
  }, [])

  const update = useCallback(
    (id: string, patch: Parameters<typeof updateProject>[1]): Project | null => {
      const updated = updateProject(id, patch)
      setProjects(loadProjects())
      return updated
    },
    [],
  )

  const getById = useCallback((id: string): Project | null => {
    return getProjectById(id)
  }, [])

  const byWorkspace = useCallback((workspaceId: string): Project[] => {
    return getProjectsByWorkspaceId(workspaceId)
  }, [])

  return { projects, create, update, getById, byWorkspace, refresh }
}
