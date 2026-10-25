import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import * as api from '../../lib/api'
import {
  getPlannerMeNext,
  PLANNER_ME_NEXT_CACHE,
  plannerMeNextQueryKey,
  type PlannerNextObject,
  type PlannerNextWork,
} from '../../lib/plannerApi'
import { withTicketNav, type TicketNavContext } from '../../lib/ticketNavContext'
import { compactTicketScope, mobileTicketNavState } from '../mobileTicketDisplay'
import { inspectionNavSuffix, mobilePath } from '../mobileRoute'
import { useLocationRouteLabels } from '../useLocationRouteLabels'

const WORKS_PREVIEW_LIMIT = 5

type Props = {
  role?: api.Role | null
  isOnline: boolean
  me?: api.Me | null
  pageScope: api.TicketScopeParams
  /** Контекст главной: карточка открыта из блока «Следующий объект». */
  ticketNav?: TicketNavContext
}

function workLabel(work: PlannerNextWork): string {
  const title = (work.title || '').trim()
  if (title) return title
  return work.kind === 'INSPECTION' ? 'Обход' : 'Заявка'
}

function ObjectPreview({ obj }: { obj: PlannerNextObject }) {
  return (
    <div className="mobileHomeUrgentRowMain">
      <span className="mobileHomeUrgentRowNo">{obj.locationName}</span>
      <span className="mobileHomeUrgentRowText">
        {[obj.address, obj.clientName].filter(Boolean).join(' · ') || '—'}
      </span>
    </div>
  )
}

/**
 * Карточка «Первый / Следующий объект» для техника на главной.
 * Запрос GET /planner/me/next в scope выбранного клиента.
 * Кэш на компанию-клиента: смена A→B→A не пересчитывает A повторно
 * (пока нет invalidate от claim / смены статуса).
 */
export function HomeNextObjectCard({ role, isOnline, me, pageScope, ticketNav }: Props) {
  const location = useLocation()
  const [expanded, setExpanded] = useState(true)
  const linkedClientCompanyId = (pageScope.linkedClientCompanyId || '').trim()
  const enabled = role === 'TECHNICIAN' && isOnline

  const nextQ = useQuery({
    queryKey: plannerMeNextQueryKey(linkedClientCompanyId),
    queryFn: () => getPlannerMeNext(linkedClientCompanyId || undefined),
    enabled,
    ...PLANNER_ME_NEXT_CACHE,
    networkMode: 'online',
  })

  const first =
    nextQ.data && nextQ.data.shiftOpen === true ? nextQ.data.first : null

  const routeTickets = useMemo(() => {
    if (!first) return [] as Array<Pick<api.TicketCard, 'id' | 'location'>>
    const ticketWork = first.works.find((work) => work.kind === 'TICKET')
    if (!ticketWork) return []
    return [
      {
        id: ticketWork.ticketId || ticketWork.id,
        location: { id: first.locationId, name: first.locationName },
      },
    ]
  }, [first])

  const routeLabels = useLocationRouteLabels(routeTickets, role, pageScope)
  const routeLabel = first ? routeLabels.get(first.locationId) ?? null : null

  if (!enabled) return null
  if (nextQ.isError || nextQ.isPending || !nextQ.isSuccess || !nextQ.data) return null

  const data = nextQ.data
  if (!data.shiftOpen || !data.first) return null

  const object = data.first
  const title = data.currentLocationId ? 'Следующий объект' : 'Первый объект'
  const workCount = object.works.length
  const previewWorks = object.works.slice(0, WORKS_PREVIEW_LIMIT)

  const ticketHref = (ticketId: string) => {
    if (!me) return mobilePath(location.pathname, `/tickets/${ticketId}`)
    return api.appendScopeToPath(
      mobilePath(location.pathname, `/tickets/${ticketId}`),
      compactTicketScope(pageScope),
      me,
    )
  }

  const inspectionHref = () => {
    if (!me) return mobilePath(location.pathname, inspectionNavSuffix('TECHNICIAN'))
    return api.appendScopeToPath(
      mobilePath(location.pathname, inspectionNavSuffix(me.role)),
      compactTicketScope(pageScope),
      me,
    )
  }

  const toggle = () => setExpanded((prev) => !prev)

  return (
    <section className="mobileCard" aria-label={title}>
      <div
        className="mobileHomeUrgentHead"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        aria-expanded={expanded}
        style={{ cursor: 'pointer' }}
      >
        <span className="mobileHomeUrgentHeadBody">
          <span className="mobileHomeQuickCardTitle">{title}</span>
          <span className="mobileHomeQuickCardSub">{object.locationName}</span>
        </span>
        {workCount > 0 ? (
          <span className="mobileHomeQuickCardBadge" style={{ marginRight: 4 }}>
            {workCount}
          </span>
        ) : null}
        <span
          className={`mobileLocationGroupChevron${expanded ? ' mobileLocationGroupChevron--open' : ''}`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {object.address ? <div className="mobileMeta">{object.address}</div> : null}
      {routeLabel ? <div className="mobileMeta">{routeLabel}</div> : null}
      {object.clientName ? <div className="mobileMeta">{object.clientName}</div> : null}

      {expanded ? (
        <>
          {object.reasons.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div className="mobileHomeQuickCardSub">Почему сюда</div>
              <ul className="mobileMeta" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {object.reasons.map((reason) => (
                  <li key={`${reason.label}:${reason.weight}`}>{reason.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {workCount > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div className="mobileHomeQuickCardSub">Там для вас · {workCount}</div>
              <div className="mobileHomeUrgentRows" style={{ marginTop: 6 }}>
                {previewWorks.map((work) => {
                  if (work.kind === 'TICKET') {
                    const id = work.ticketId || work.id
                    return (
                      <Link
                        key={`ticket-${id}`}
                        to={ticketHref(id)}
                        state={ticketNav ? withTicketNav(mobileTicketNavState('home'), { ...ticketNav, source: 'home' }) : mobileTicketNavState('home')}
                        className="mobileHomeUrgentRow"
                      >
                        <span className="mobileHomeUrgentRowMain">
                          <span className="mobileHomeUrgentRowNo">{workLabel(work)}</span>
                          {work.summary ? <span className="mobileHomeUrgentRowText">{work.summary}</span> : null}
                        </span>
                      </Link>
                    )
                  }
                  return (
                    <Link
                      key={`inspection-${work.scheduleId || work.id}`}
                      to={inspectionHref()}
                      className="mobileHomeUrgentRow"
                    >
                      <span className="mobileHomeUrgentRowMain">
                        <span className="mobileHomeUrgentRowNo">{workLabel(work)}</span>
                        <span className="mobileHomeUrgentRowText">Обход · старт на экране «Сегодня»</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}

          {data.next.length > 0 ? (
            <details style={{ marginTop: 10 }}>
              <summary className="mobileHomeQuickCardSub" style={{ cursor: 'pointer' }}>
                Что может прийти дальше
              </summary>
              <div className="mobileHomeUrgentRows" style={{ marginTop: 6 }}>
                {data.next.map((obj) => (
                  <div key={obj.locationId} className="mobileHomeUrgentRow" style={{ cursor: 'default' }}>
                    <ObjectPreview obj={obj} />
                    <span className="mobileHomeUrgentRowAge">{obj.works.length}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
