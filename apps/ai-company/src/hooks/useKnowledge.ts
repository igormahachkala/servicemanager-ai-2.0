import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeKnowledgeStats,
  ensureSeedKnowledge,
  filterKnowledge,
  getAllTags,
  getAssignmentsForEmployee,
  getKnowledgeById,
  getKnowledgeForWorkspace,
  loadKnowledgeStore,
  searchKnowledge,
  type Knowledge,
  type KnowledgeFilter,
  type KnowledgeStats,
} from '../domain/knowledge/knowledgeStorage'

export function useKnowledge() {
  const [store, setStore] = useState(() => ensureSeedKnowledge())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<KnowledgeFilter>({
    status: 'all',
    type: 'all',
    source: 'all',
    workspaceId: 'all',
    tag: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedKnowledge()
    setStore(loadKnowledgeStore())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-knowledge' ||
        event.key === 'ai-company-knowledge-collections'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const searched = searchKnowledge(store.items, query)
    return filterKnowledge(searched, filter).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [store.items, query, filter])

  const stats = useMemo(() => computeKnowledgeStats(store), [store])
  const tags = useMemo(() => getAllTags(store.items), [store.items])

  return {
    items: store.items,
    assignments: store.assignments,
    filtered,
    stats,
    tags,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
    getById: (id: string) => getKnowledgeById(id, store),
    getForWorkspace: (workspaceId: string) => getKnowledgeForWorkspace(workspaceId, store),
    getAssignmentsForEmployee: (employeeId: string) => getAssignmentsForEmployee(employeeId, store),
  }
}

export type { Knowledge, KnowledgeFilter, KnowledgeStats }
