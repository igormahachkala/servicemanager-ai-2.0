import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import * as api from '../../lib/api'
import { getPlannerMeNext, type PlannerNextObject, type PlannerNextWork } from '../../lib/plannerApi'
import { compactTicketScope, mobileTicketNavState } from '../mobileTicketDisplay'
import { inspectionNavSuffix, mobilePath } from '../mobileRoute'

type Props = {
  role?: api.Role | null
  isOnline: boolean
  me?: api.Me | null
  pageScope: api.TicketScopeParams
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
 * Запрос GET /planner/me/next; без сети и без смены / first — не рендерится.
 */
export function HomeNextObjectCard({ role, isOnline, me, pageScope }: Props) {
  const location = useLocation()
  const enabled = role === 'TECHNICIAN' && isOnline

  const nextQ = useQuery({
    queryKey: ['planner-me-next'],
    queryFn: getPlannerMeNext,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    networkMode: 'online',
    gcTime: 0,
  })

  if (!enabled) return null
  if (nextQ.isError || nextQ.isPending || !nextQ.isSuccess || !nextQ.data) return null

  const data = nextQ.data
  if (!data.shiftOpen || !data.first) return null

  const first = data.first
  const title = data.currentLocationId ? 'Следующий объект' : 'Первый объект'
  const workCount = first.works.length

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

  return (
    <section className="mobileCard" aria-label={title}>
      <div className="mobileHomeUrgentHead">
        <span className="mobileHomeUrgentHeadBody">
          <span className="mobileHomeQuickCardTitle">{title}</span>
          <span className="mobileHomeQuickCardSub">{first.locationName}</span>
        </span>
      </div>

      {first.address ? <div className="mobileMeta">{first.address}</div> : null}
      {first.clientName ? <div className="mobileMeta">{first.clientName}</div> : null}

      {first.reasons.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <div className="mobileHomeQuickCardSub">Почему сюда</div>
          <ul className="mobileMeta" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {first.reasons.map((reason) => (
              <li key={`${reason.label}:${reason.weight}`}>{reason.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {workCount > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div className="mobileHomeQuickCardSub">Там для вас · {workCount}</div>
          <div className="mobileHomeUrgentRows" style={{ marginTop: 6 }}>
            {first.works.map((work) => {
              if (work.kind === 'TICKET') {
                const id = work.ticketId || work.id
                return (
                  <Link
                    key={`ticket-${id}`}
                    to={ticketHref(id)}
                    state={mobileTicketNavState('home')}
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
                <Link key={`inspection-${work.scheduleId || work.id}`} to={inspectionHref()} className="mobileHomeUrgentRow">
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
    </section>
  )
}
