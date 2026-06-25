import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureSeedEvents,
  filterEvents,
  groupEventsByDate,
  loadEvents,
  scopeEvents,
  searchEvents,
  type CompanyEvent,
  type EventFilter,
  type EventScope,
} from '../domain/events/eventStorage'
import { useI18n } from '../i18n'

type UseEventsOptions = {
  scope?: EventScope
  scopeId?: string | null
}

export function useEvents(options: UseEventsOptions = {}) {
  const { scope = 'company', scopeId = null } = options
  const { language } = useI18n()
  const [events, setEvents] = useState<CompanyEvent[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EventFilter>({
    employeeId: 'all',
    workspaceId: 'all',
    severity: 'all',
    type: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedEvents()
    setEvents(loadEvents())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-events') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const scoped = useMemo(
    () => scopeEvents(events, scope, scopeId),
    [events, scope, scopeId],
  )

  const filtered = useMemo(() => {
    const searched = searchEvents(scoped, query)
    return filterEvents(searched, filter)
  }, [scoped, query, filter])

  const grouped = useMemo(
    () => groupEventsByDate(filtered, language === 'ru' ? 'ru-RU' : 'en-US'),
    [filtered, language],
  )

  const stats = useMemo(
    () => ({
      total: scoped.length,
      info: scoped.filter((e) => e.severity === 'info').length,
      success: scoped.filter((e) => e.severity === 'success').length,
      warn: scoped.filter((e) => e.severity === 'warn').length,
      error: scoped.filter((e) => e.severity === 'error').length,
      withEmployee: scoped.filter((e) => e.employeeId !== null).length,
      withWorkspace: scoped.filter((e) => e.workspaceId !== null).length,
    }),
    [scoped],
  )

  return {
    events,
    scoped,
    filtered,
    grouped,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
    scope,
    scopeId,
  }
}
