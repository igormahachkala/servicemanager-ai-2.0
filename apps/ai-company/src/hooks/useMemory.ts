import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collectTags,
  computeMemoryStats,
  createMemory,
  ensureSeedMemories,
  filterMemories,
  getMemoriesByEmployee,
  loadMemoryEntries,
  searchMemories,
  type CreateMemoryInput,
  type MemoryEntry,
  type MemoryFilter,
} from '../domain/memory/memory'

export function useMemory(employeeId: string | undefined) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MemoryFilter>({
    type: 'all',
    importance: 'all',
    workspaceId: 'all',
    tag: 'all',
  })

  const refresh = useCallback(() => {
    if (!employeeId) {
      setEntries([])
      return
    }
    ensureSeedMemories(employeeId)
    setEntries(getMemoriesByEmployee(employeeId))
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-employee-memory') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const searched = searchMemories(entries, query)
    return filterMemories(searched, filter)
  }, [entries, query, filter])

  const stats = useMemo(() => computeMemoryStats(entries), [entries])
  const tags = useMemo(() => collectTags(entries), [entries])

  const add = useCallback(
    (input: Omit<CreateMemoryInput, 'employeeId'>): MemoryEntry | null => {
      if (!employeeId) return null
      const created = createMemory({ ...input, employeeId })
      setEntries(loadMemoryEntries().filter((item) => item.employeeId === employeeId))
      return created
    },
    [employeeId],
  )

  return {
    entries,
    filtered,
    stats,
    tags,
    query,
    setQuery,
    filter,
    setFilter,
    add,
    refresh,
  }
}
