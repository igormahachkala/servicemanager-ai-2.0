import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'
import { resolveMobileReturnTo } from './mobileReturnTo'

function BackArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

/** Плашка «← Назад» над заголовком входа из списка «Ещё». */
export function MobileSectionBackLink() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const fallback = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const observer = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    const scope = { linkedClientCompanyId: linked || undefined, companyId: observer || undefined }
    return api.appendScopeToPath(mobilePath(location.pathname, ''), scope, meQ.data)
  }, [location.pathname, location.search, meQ.data])

  const returnTo = (location.state as { returnTo?: unknown } | null)?.returnTo
  const to = resolveMobileReturnTo({ pathname: location.pathname, returnTo, fallback })

  return (
    <div className="mobileTicketDetailsToolbar">
      <Link to={to} replace className="mobileDetailsBackLink mobilePatrolBackLink">
        <BackArrow />
        Назад
      </Link>
    </div>
  )
}
