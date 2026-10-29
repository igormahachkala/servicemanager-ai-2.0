import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { OnSiteCard } from './OnSiteCard'
import { OnSiteFilters, type OnSiteFilterValue } from './OnSiteFilters'
import { ON_SITE_EMPTY_FILTERED, ON_SITE_EMPTY_UNFILTERED, onSiteErrorText } from './onSiteDisplay'

type Props = {
  surface: 'desktop' | 'mobile'
}

export function OnSiteBoard({ surface }: Props) {
  const location = useLocation()
  const [filters, setFilters] = useState<OnSiteFilterValue>({
    state: '',
    shift: '',
    name: '',
    sort: 'state',
  })
  const [nameQuery, setNameQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setNameQuery(filters.name.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [filters.name])

  const listQ = useQuery({
    queryKey: ['on-site', filters.state, filters.shift, nameQuery, filters.sort],
    queryFn: () => api.listOnSite({
      state: filters.state || undefined,
      shift: filters.shift || undefined,
      technician: nameQuery || undefined,
      sort: filters.sort,
    }),
  })
  const items = listQ.data?.items ?? []

  const noticeClass = surface === 'mobile' ? 'mobileNotice' : 'panel'
  const errorClass = surface === 'mobile' ? 'mobileNotice mobileNoticeError' : 'alert'

  return (
    <div>
      <OnSiteFilters surface={surface} value={filters} onChange={setFilters} />
      {listQ.isLoading ? <div className={noticeClass}>Загрузка…</div> : null}
      {listQ.isError ? <div className={errorClass}>{onSiteErrorText(listQ.error)}</div> : null}
      {listQ.data && items.length === 0 ? (
        <div className={noticeClass} role="status">
          {listQ.data.emptyReason === 'filtered_out' ? ON_SITE_EMPTY_FILTERED : ON_SITE_EMPTY_UNFILTERED}
        </div>
      ) : null}
      {items.map((card) => (
        <OnSiteCard key={card.userId} card={card} surface={surface} pathname={location.pathname} />
      ))}
    </div>
  )
}
