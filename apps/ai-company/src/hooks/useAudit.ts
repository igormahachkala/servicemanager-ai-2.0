import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureSeedAuditEvents,
  filterAuditEvents,
  loadAuditEvents,
  searchAuditEvents,
  type AuditEvent,
  type AuditFilter,
} from '../domain/audit/auditStorage'

export function useAudit() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AuditFilter>({
    actorType: 'all',
    action: 'all',
    targetType: 'all',
    workspaceId: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedAuditEvents()
    setEvents(loadAuditEvents())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-audit-events') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const searched = searchAuditEvents(events, query)
    return filterAuditEvents(searched, filter)
  }, [events, query, filter])

  const stats = useMemo(
    () => ({
      total: events.length,
      owner: events.filter((e) => e.actorType === 'owner').length,
      employee: events.filter((e) => e.actorType === 'employee').length,
      system: events.filter((e) => e.actorType === 'system').length,
    }),
    [events],
  )

  return { events, filtered, stats, query, setQuery, filter, setFilter, refresh }
}
