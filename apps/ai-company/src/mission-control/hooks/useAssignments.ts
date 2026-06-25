import { useCallback, useEffect, useState } from 'react'
import {
  createAssignment,
  getAssignmentsByEmployeeId,
  getAssignmentsByWorkspaceId,
  loadAssignments,
  removeAssignment,
  updateAssignment,
  type Assignment,
  type CreateAssignmentInput,
} from '../data/assignment'

export function useAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>(() => loadAssignments())

  const refresh = useCallback(() => {
    setAssignments(loadAssignments())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-assignments') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const create = useCallback((input: CreateAssignmentInput): Assignment => {
    const created = createAssignment(input)
    setAssignments(loadAssignments())
    return created
  }, [])

  const update = useCallback(
    (id: string, patch: Parameters<typeof updateAssignment>[1]): Assignment | null => {
      const updated = updateAssignment(id, patch)
      setAssignments(loadAssignments())
      return updated
    },
    [],
  )

  const remove = useCallback((id: string): boolean => {
    const ok = removeAssignment(id)
    if (ok) setAssignments(loadAssignments())
    return ok
  }, [])

  const byWorkspace = useCallback(
    (workspaceId: string): Assignment[] => {
      return assignments.filter((item) => item.workspaceId === workspaceId)
    },
    [assignments],
  )

  const byEmployee = useCallback(
    (employeeId: string): Assignment[] => {
      return assignments.filter((item) => item.employeeId === employeeId)
    },
    [assignments],
  )

  return {
    assignments,
    create,
    update,
    remove,
    byWorkspace,
    byEmployee,
    getByWorkspaceId: getAssignmentsByWorkspaceId,
    getByEmployeeId: getAssignmentsByEmployeeId,
    refresh,
  }
}
