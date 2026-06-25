import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CHANGE_EVENT,
  buildCollaborationStats,
  filterCollaborationSessions,
  getCollaborationSessionById,
  loadCollaborationSessions,
  readCollaborationStorageKey,
  type CollaborationFilter,
  type CollaborationStats,
} from '../domain/collaboration/collaborationStorage'
import type { CollaborationSession } from '../domain/collaboration/collaborationSession'

export function useCollaboration(sessionId?: string) {
  const [sessions, setSessions] = useState<CollaborationSession[]>(() => loadCollaborationSessions())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CollaborationFilter>({
    status: 'all',
    projectId: null,
    employeeId: null,
  })

  const refresh = useCallback(() => {
    setSessions(loadCollaborationSessions())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === readCollaborationStorageKey()) refresh()
    }
    const onChange = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [refresh])

  const stats = useMemo<CollaborationStats>(() => buildCollaborationStats(sessions), [sessions])

  const filtered = useMemo(
    () => filterCollaborationSessions(sessions, filter, query),
    [sessions, filter, query],
  )

  const selected = useMemo(
    () => (sessionId ? getCollaborationSessionById(sessionId) : null),
    [sessionId, sessions],
  )

  return {
    sessions,
    filtered,
    selected,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
  }
}
