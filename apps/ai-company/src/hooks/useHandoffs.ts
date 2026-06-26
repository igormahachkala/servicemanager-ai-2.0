import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HANDOFF_STATUSES,
  HANDOFF_TARGETS,
  acceptHandoff,
  cancelHandoff,
  createHandoffFromTemplate,
  filterHandoffs,
  getHandoffById,
  getHandoffStats,
  initializeHandoffEngine,
  listHandoffTemplates,
  listHandoffs,
  markHandoffInProgress,
  prepareHandoff,
  rejectHandoff,
  returnHandoffResult,
  sendHandoff,
  submitHandoffForApproval,
  type Handoff,
  type HandoffFilter,
  type HandoffResult,
  type HandoffStatus,
  type HandoffTarget,
} from '../domain/handoff'

export function useHandoffs(initialFilter?: Partial<HandoffFilter>) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [filter, setFilter] = useState<HandoffFilter>({
    projectId: initialFilter?.projectId ?? 'all',
    workspaceId: initialFilter?.workspaceId ?? 'all',
    employeeId: initialFilter?.employeeId ?? 'all',
    target: initialFilter?.target ?? 'all',
    status: initialFilter?.status ?? 'all',
  })

  const refresh = useCallback(() => {
    initializeHandoffEngine()
    setHandoffs(listHandoffs())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-handoffs') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => filterHandoffs(handoffs, filter), [handoffs, filter])
  const stats = useMemo(() => getHandoffStats(filter), [handoffs, filter])

  const getById = useCallback((id: string) => getHandoffById(id), [handoffs])

  const actions = useMemo(
    () => ({
      prepare: (id: string) => {
        const updated = prepareHandoff(id)
        refresh()
        return updated
      },
      submitForApproval: (id: string) => {
        const updated = submitHandoffForApproval(id)
        refresh()
        return updated
      },
      send: (id: string) => {
        const updated = sendHandoff(id)
        refresh()
        return updated
      },
      markInProgress: (id: string) => {
        const updated = markHandoffInProgress(id)
        refresh()
        return updated
      },
      returnResult: (id: string, result: Omit<HandoffResult, 'deliveredAt'>) => {
        const updated = returnHandoffResult(id, result)
        refresh()
        return updated
      },
      accept: (id: string) => {
        const updated = acceptHandoff(id)
        refresh()
        return updated
      },
      reject: (id: string, reason: string) => {
        const updated = rejectHandoff(id, reason)
        refresh()
        return updated
      },
      cancel: (id: string) => {
        const updated = cancelHandoff(id)
        refresh()
        return updated
      },
      createFromTemplate: createHandoffFromTemplate,
    }),
    [refresh],
  )

  const targets: Array<HandoffTarget | 'all'> = ['all', ...HANDOFF_TARGETS]
  const statuses: Array<HandoffStatus | 'all'> = ['all', ...HANDOFF_STATUSES]
  const templates = listHandoffTemplates()

  return {
    handoffs,
    filtered,
    stats,
    filter,
    setFilter,
    refresh,
    getById,
    templates,
    targets,
    statuses,
    ...actions,
  }
}

export type { Handoff, HandoffFilter, HandoffResult, HandoffStatus, HandoffTarget }
