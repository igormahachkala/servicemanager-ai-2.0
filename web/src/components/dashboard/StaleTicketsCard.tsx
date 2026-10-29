import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import * as api from '../../lib/api'
import { buildStaleBoardHref, STALE_TICKET_AGE_DAYS, STALE_TICKETS_TITLE, staleBoardCount } from '../../lib/staleTickets'
import { KpiCard } from './KpiCard'

function canReadCompanyContext(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR'
}

/**
 * «Заявки старше 10 дней» на главной компьютера — живой счётчик, в отличие от
 * демо-карточек рядом. Скоуп тот же, что у доски: linkedClientCompanyId из
 * адреса или сохранённого выбора, companyId только у PLATFORM_ADMIN.
 * Подрядчик без выбранного клиента карточку не видит: без клиента доска пуста.
 */
export function StaleTicketsCard() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const role = meQ.data?.role
  const companyQ = useQuery({
    queryKey: ['board-company-context'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && role !== 'PLATFORM_ADMIN' && canReadCompanyContext(role),
  })

  const scope = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    const linkedClientCompanyId = (sp.get('linkedClientCompanyId')?.trim() || api.getLinkedClientCompanyId()).trim()
    const companyId = role === 'PLATFORM_ADMIN' ? (sp.get('companyId')?.trim() || api.getObserverCompanyId()).trim() : ''
    return { linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: companyId || undefined }
  }, [location.search, role])

  const companyKnown = !canReadCompanyContext(role) || companyQ.isSuccess || companyQ.isError
  const providerWithoutClient = companyQ.data?.type === 'PROVIDER' && !scope.linkedClientCompanyId
  const enabled = !!meQ.data && companyKnown && !providerWithoutClient

  const staleQ = useQuery({
    queryKey: ['dashboard-stale-board', scope.linkedClientCompanyId ?? '', scope.companyId ?? ''],
    queryFn: () => api.board({ ...scope, take: 1, olderThanDays: STALE_TICKET_AGE_DAYS }),
    enabled,
  })

  if (!enabled) return null
  const value = staleQ.isSuccess ? staleBoardCount(staleQ.data) : staleQ.isError ? '—' : '…'

  return (
    <Link
      to={buildStaleBoardHref(scope)}
      aria-label={`${STALE_TICKETS_TITLE}: открыть список`}
      style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}
    >
      <KpiCard
        label={STALE_TICKETS_TITLE}
        value={value}
        hint="Незакрытые, считая от даты создания. Открыть список →"
        tone="amber"
      />
    </Link>
  )
}
