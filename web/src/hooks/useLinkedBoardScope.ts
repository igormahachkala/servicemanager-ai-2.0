import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'

/**
 * SMA-019 — общий резолвер scope для board/archive.
 *
 * Переиспользует существующую visibility-логику:
 * - читает linkedClientCompanyId / companyId из URL, затем из сохранённого scope;
 * - PLATFORM_ADMIN работает как наблюдатель компании (companyId);
 * - сохраняет scope из URL в localStorage (как BoardPage/Shell).
 *
 * Никакой собственной авторизации на клиенте: реальные права отдаёт backend
 * по этим же параметрам (/tickets/board), мы лишь прокидываем scope.
 */
export type LinkedBoardScope = {
  me: api.Me | undefined
  isMeReady: boolean
  observerCompanyId: string
  linkedClientCompanyId: string
  /** Параметры для api.board(...) / списочных запросов. */
  boardParams: { linkedClientCompanyId?: string; companyId?: string }
  /** Параметры scope для построения ссылок (api.appendScopeToPath, ticket links). */
  ticketScope: api.TicketScopeParams | undefined
}

export function useLinkedBoardScope(): LinkedBoardScope {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const me = meQ.data

  const requestedCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId')?.trim() || api.getObserverCompanyId(me)).trim()
  }, [location.search, me])

  const requestedLinkedClientCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('linkedClientCompanyId')?.trim() || api.getLinkedClientCompanyId(me)).trim()
  }, [location.search, me])

  useEffect(() => {
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), me)
  }, [location.search, me])

  const observerCompanyId = me?.role === 'PLATFORM_ADMIN' ? requestedCompanyId : ''
  const linkedClientCompanyId = observerCompanyId ? '' : requestedLinkedClientCompanyId

  const ticketScope = useMemo<api.TicketScopeParams | undefined>(() => {
    if (observerCompanyId) return { companyId: observerCompanyId }
    if (linkedClientCompanyId) return { linkedClientCompanyId }
    return undefined
  }, [observerCompanyId, linkedClientCompanyId])

  return {
    me,
    isMeReady: meQ.isSuccess,
    observerCompanyId,
    linkedClientCompanyId,
    boardParams: {
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: linkedClientCompanyId || undefined,
    },
    ticketScope,
  }
}
