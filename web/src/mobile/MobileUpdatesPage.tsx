import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { formatUpdateDate } from '../lib/productUpdates'
import { ProductUpdateCard } from '../ui/ProductUpdateCard'
import { MobileSectionBackLink } from './MobileSectionBackLink'

/**
 * «Что нового» на мобильном: история опубликованных обновлений и карточка.
 * Только чтение — ведение карточек в управленческой части (/updates).
 * Список уже отобран бэкендом по компании и роли.
 */
export function MobileUpdatesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedId = new URLSearchParams(location.search).get('id')
  const updatesQ = useQuery({ queryKey: ['product-updates'], queryFn: api.productUpdates })
  const rows = useMemo(() => updatesQ.data ?? [], [updatesQ.data])
  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null

  const openId = (id: string | null) => {
    const sp = new URLSearchParams(location.search)
    if (id) sp.set('id', id)
    else sp.delete('id')
    const qs = sp.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="mobileSection">
      <MobileSectionBackLink />
      <h1 className="mobileTitle">Что нового</h1>

      {updatesQ.isError ? (
        <div className="mobileNotice mobileNoticeError">Не удалось загрузить обновления.</div>
      ) : updatesQ.isLoading ? (
        <div className="mobileMeta">Загрузка…</div>
      ) : selected ? (
        <div className="mobileCard">
          <button type="button" className="mobileBtn mobileBtnSecondary" style={{ marginBottom: 12 }} onClick={() => openId(null)}>
            ← Все обновления
          </button>
          <ProductUpdateCard update={selected} />
        </div>
      ) : selectedId ? (
        <div className="mobileCard">
          <div className="mobileMeta">Обновление не найдено или недоступно.</div>
          <button type="button" className="mobileBtn mobileBtnSecondary" style={{ marginTop: 12 }} onClick={() => openId(null)}>
            ← Все обновления
          </button>
        </div>
      ) : rows.length ? (
        rows.map((row) => (
          <button key={row.id} type="button" className="mobileCard mobileUpdatesRow" onClick={() => openId(row.id)}>
            <div style={{ fontWeight: 700 }}>{row.title}</div>
            <div className="mobileMeta" style={{ marginTop: 2 }}>{formatUpdateDate(row.publishedAt)}</div>
            {row.summary ? <div style={{ marginTop: 6 }}>{row.summary}</div> : null}
          </button>
        ))
      ) : (
        <div className="mobileCard">
          <div className="mobileMeta">Опубликованных обновлений пока нет.</div>
        </div>
      )}
    </div>
  )
}
