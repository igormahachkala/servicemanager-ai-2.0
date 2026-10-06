import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'
import { getMobileMoreEntries } from './mobileMoreEntries'

/**
 * SMA-MOBILE-SERVICE-OS — экран «Ещё». Обычный список входов в существующие функции
 * (не огромный popup). Видимость — по существующим ролевым сигналам (getMobileMoreEntries).
 */

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function MoreIcon({ id }: { id: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (id === 'materials') {
    return (
      <svg {...common}>
        <path d="M12 3l8 4.5v9L12 21l-8 -4.5v-9z" />
        <path d="M12 12l8 -4.5" />
        <path d="M12 12v9M12 12L4 7.5" />
      </svg>
    )
  }
  if (id === 'equipment') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
      </svg>
    )
  }
  if (id === 'shift') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    )
  }
  if (id === 'analytics') {
    return (
      <svg {...common}>
        <line x1="4" y1="20" x2="20" y2="20" />
        <rect x="6" y="11" width="3" height="7" />
        <rect x="11" y="7" width="3" height="11" />
        <rect x="16" y="13" width="3" height="5" />
      </svg>
    )
  }
  if (id === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06 .06a2 2 0 1 1 -2.83 2.83l-.06 -.06a1.65 1.65 0 0 0 -1.82 -.33 1.65 1.65 0 0 0 -1 1.51V21a2 2 0 0 1 -4 0v-.09a1.65 1.65 0 0 0 -1 -1.51 1.65 1.65 0 0 0 -1.82 .33l-.06 .06a2 2 0 1 1 -2.83 -2.83l.06 -.06a1.65 1.65 0 0 0 .33 -1.82 1.65 1.65 0 0 0 -1.51 -1H3a2 2 0 0 1 0 -4h.09a1.65 1.65 0 0 0 1.51 -1 1.65 1.65 0 0 0 -.33 -1.82l-.06 -.06a2 2 0 1 1 2.83 -2.83l.06 .06a1.65 1.65 0 0 0 1.82 .33H9a1.65 1.65 0 0 0 1 -1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82 -.33l.06 -.06a2 2 0 1 1 2.83 2.83l-.06 .06a1.65 1.65 0 0 0 -.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0 -1.51 1z" />
      </svg>
    )
  }
  // profile
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0 -4 -4H8a4 4 0 0 0 -4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function MobileMorePage() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const currentScope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const observer = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return { linkedClientCompanyId: linked || undefined, companyId: observer || undefined }
  }, [location.search, meQ.data])

  const scoped = (to: string) => api.appendScopeToPath(to, currentScope, meQ.data)
  const entries = useMemo(() => getMobileMoreEntries(meQ.data, location.pathname), [meQ.data, location.pathname])
  const backHref = scoped(mobilePath(location.pathname, ''))

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Главная
        </Link>
      </div>

      <h1 className="mobileTitle">Ещё</h1>
      <div className="mobileSubtitle">Разделы, доступные вашей роли</div>

      <div className="mobileCard mobileProfileMenu" style={{ marginTop: 8 }}>
        {meQ.isLoading ? <div className="mobileMeta">Загружаем доступные разделы…</div> : null}
        {!meQ.isLoading && entries.length === 0 ? (
          <div className="mobileEmptyState" role="status">
            <div className="mobileEmptyStateTitle">Для вашей роли нет дополнительных разделов</div>
          </div>
        ) : null}
        {entries.map((entry) => (
          <Link key={entry.id} to={scoped(entry.to)} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              <MoreIcon id={entry.id} />
            </span>
            <span className="mobileProfileMenuLabel">
              {entry.label}
              <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>{entry.hint}</span>
            </span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default MobileMorePage
