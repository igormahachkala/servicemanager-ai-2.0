import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TicketScopeLike } from '../offline/cacheKeys'
import {
  ticketDetailCacheState,
  type TicketDetailCacheState,
} from '../offline/ticketDetailCache'
import { prefetchTicketForOffline, selectAutoPrefetchTicketIds } from '../offline/ticketPrefetch'

type TicketLike = {
  id: string
  status?: string
  assignedTechnicianId?: string | null
  assignedTechnician?: { id?: string | null } | null
}

type Params = {
  allTickets: TicketLike[]
  homeListTickets: TicketLike[]
  visibleTickets: TicketLike[]
  meId?: string
  scope?: TicketScopeLike
  enabled: boolean
  online: boolean
  storageReady: boolean
}

export type TicketOfflineCacheController = {
  states: ReadonlyMap<string, TicketDetailCacheState>
  selectedIds: ReadonlySet<string>
  toggleSelected: (ticketId: string) => void
  cacheSelected: () => Promise<void>
  refreshTicket: (ticketId: string) => Promise<void>
  busy: boolean
  progress: { current: number; total: number } | null
  error: string
}

export function useTicketOfflineCache(params: Params): TicketOfflineCacheController {
  const [states, setStates] = useState<Map<string, TicketDetailCacheState>>(() => new Map())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const runningRef = useRef(false)
  const autoRunKeyRef = useRef('')
  const ticketIdsKey = params.allTickets.map((ticket) => ticket.id).join('\x00')

  const refreshStates = useCallback(async () => {
    if (!params.storageReady) return
    const next = new Map<string, TicketDetailCacheState>()
    await Promise.all(
      params.allTickets.map(async (ticket) => {
        next.set(ticket.id, await ticketDetailCacheState(ticket.id, params.scope))
      }),
    )
    setStates(next)
  }, [params.allTickets, params.scope, params.storageReady])

  useEffect(() => {
    void refreshStates()
  }, [refreshStates, ticketIdsKey])

  const cacheIds = useCallback(async (ids: string[]) => {
    if (runningRef.current || ids.length === 0) return
    runningRef.current = true
    setError('')
    setProgress({ current: 0, total: ids.length })
    try {
      for (let index = 0; index < ids.length; index += 1) {
        const ticketId = ids[index]!
        setProgress({ current: index + 1, total: ids.length })
        const result = await prefetchTicketForOffline(ticketId, params.scope)
        if (!result.ok) {
          setError(`Заявка не закэширована: ${result.message}`)
          if (result.storageUnavailable) break
        }
      }
    } finally {
      runningRef.current = false
      setProgress(null)
      await refreshStates()
    }
  }, [params.scope, refreshStates])

  const autoIds = useMemo(
    () => selectAutoPrefetchTicketIds(params.allTickets, params.homeListTickets, params.meId),
    [params.allTickets, params.homeListTickets, params.meId],
  )
  const autoKey = autoIds.join('\x00')

  useEffect(() => {
    if (!params.enabled || !params.online || !params.storageReady || !autoKey) return
    if (autoRunKeyRef.current === autoKey) return
    autoRunKeyRef.current = autoKey
    void (async () => {
      const missing: string[] = []
      for (const ticketId of autoIds) {
        const state = await ticketDetailCacheState(ticketId, params.scope)
        if (state !== 'complete') missing.push(ticketId)
      }
      await cacheIds(missing)
    })()
  }, [
    autoIds,
    autoKey,
    cacheIds,
    params.enabled,
    params.online,
    params.scope,
    params.storageReady,
  ])

  const visibleIds = useMemo(
    () => new Set(params.visibleTickets.map((ticket) => ticket.id)),
    [params.visibleTickets],
  )
  useEffect(() => {
    setSelectedIds((previous) => new Set([...previous].filter((id) => visibleIds.has(id))))
  }, [visibleIds])

  const toggleSelected = useCallback((ticketId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }, [])

  const cacheSelected = useCallback(async () => {
    await cacheIds([...selectedIds])
    setSelectedIds(new Set())
  }, [cacheIds, selectedIds])

  const refreshTicket = useCallback(async (ticketId: string) => {
    await cacheIds([ticketId])
  }, [cacheIds])

  return {
    states,
    selectedIds,
    toggleSelected,
    cacheSelected,
    refreshTicket,
    busy: progress !== null,
    progress,
    error,
  }
}
