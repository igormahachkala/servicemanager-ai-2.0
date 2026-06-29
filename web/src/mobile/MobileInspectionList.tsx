import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

function fmtDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

function runStatusLabel(status: api.InspectionRunStatus): string {
  return status === 'IN_PROGRESS' ? 'В процессе' : 'Завершён'
}

function reportStatusLabel(status: api.InspectionReportStatus): string {
  if (status === 'DRAFT') return 'Черновик'
  if (status === 'SUBMITTED') return 'На проверке'
  if (status === 'APPROVED') return 'Утверждён'
  if (status === 'REJECTED') return 'Отклонён'
  return status
}

function reportStatusMod(status: api.InspectionReportStatus): string {
  if (status === 'SUBMITTED') return 'submitted'
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  return 'draft'
}

/** Renders inspection runs list.
 *  standalone=true → wraps in mobileSection with title (for /m/inspection route).
 *  standalone=false (default) → bare cards for embedding in MobileMyTickets. */
export function MobileInspectionList({ standalone = false }: { standalone?: boolean }) {
  const location = useLocation()

  const runsQ = useQuery({
    queryKey: ['inspection-runs'],
    queryFn: api.getInspectionRuns,
  })

  // SMA-PATROLS-005: история обходов конкретного объекта (/m/inspection/object/:locationId).
  const params = useParams<{ locationId?: string }>()
  const objectLocationId = (params.locationId || '').trim()
  const isObjectHistory = !!objectLocationId

  const objectRuns = useMemo(() => {
    if (!isObjectHistory) return []
    return (runsQ.data || [])
      .filter((r) => r.location?.id === objectLocationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
  }, [runsQ.data, isObjectHistory, objectLocationId])

  // Список не содержит исполнителя/нарушений/созданных заявок — тянем из детали обхода.
  const detailQs = useQueries({
    queries: objectRuns.map((r) => ({
      queryKey: ['inspection-run', r.id],
      queryFn: () => api.getInspectionRun(r.id),
    })),
  })

  if (isObjectHistory) {
    const objectName = objectRuns[0]?.location?.name || 'Объект'
    return (
      <div className="mobileSection">
        <div className="mobileTicketDetailsToolbar">
          <Link to={mobilePath(location.pathname, '/inspection')} className="mobileDetailsBackLink">← Обходы</Link>
        </div>
        <div>
          <h1 className="mobileTitle">История обходов</h1>
          <div className="mobileSubtitle">{objectName}</div>
        </div>
        {runsQ.isLoading ? (
          <div className="mobileCard mobileMeta">Загружаем обходы…</div>
        ) : runsQ.isError ? (
          <div className="mobileNotice mobileNoticeError">{(runsQ.error as any)?.message || String(runsQ.error)}</div>
        ) : objectRuns.length === 0 ? (
          <div className="mobileCard mobileEmptyState" role="status">
            <div className="mobileEmptyStateTitle">По этому объекту обходов пока нет</div>
          </div>
        ) : (
          objectRuns.map((run, i) => {
            const dq = detailQs[i]
            const items = dq?.data?.items || []
            const violations = items.filter((it) => it.status === 'ISSUE' || it.status === 'CRITICAL').length
            const tickets = items.filter((it) => !!it.ticketId).length
            const pb = dq?.data?.performedBy
            const performer = pb
              ? ([pb.firstName, pb.lastName].filter(Boolean).join(' ').trim() || pb.email)
              : dq?.isLoading
                ? '…'
                : '—'
            const loading = dq?.isLoading
            return (
              <div key={run.id} className="mobileCard mobilePatrolCard">
                <div className="mobilePatrolCardTop">
                  <div className="mobilePatrolCardTitle">{run.title}</div>
                  <span className={`mobilePatrolRunStatus mobilePatrolRunStatus--${run.status === 'IN_PROGRESS' ? 'inprogress' : 'completed'}`}>
                    {runStatusLabel(run.status)}
                  </span>
                </div>
                <div className="mobilePatrolCardMeta">
                  <span>{fmtDate(run.completedAt || run.createdAt)}</span>
                  <span>· {performer}</span>
                  {run.reportStatus ? (
                    <span className={`mobilePatrolReportBadge mobilePatrolReportBadge--${reportStatusMod(run.reportStatus)}`}>
                      {reportStatusLabel(run.reportStatus)}
                    </span>
                  ) : null}
                </div>
                <div className="mobilePatrolCardMeta">
                  <span>Нарушений: {loading ? '…' : violations}</span>
                  <span>· Заявок создано: {loading ? '…' : tickets}</span>
                </div>
                <Link to={mobilePath(location.pathname, `/inspection/${run.id}`)} className="mobileBtn mobileBtnGhost" style={{ textAlign: 'center', marginTop: 2 }}>
                  Открыть
                </Link>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const content = (() => {
    if (runsQ.isLoading) {
      return <div className="mobileCard mobileMeta">Загружаем обходы…</div>
    }
    if (runsQ.isError) {
      return (
        <div className="mobileNotice mobileNoticeError">
          {(runsQ.error as any)?.message || String(runsQ.error)}
        </div>
      )
    }
    const runs = runsQ.data || []
    if (runs.length === 0) {
      return (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">Обходов пока нет</div>
          <p className="mobileEmptyStateHint">
            Создайте шаблон и запустите первый обход через управленческую часть.
          </p>
        </div>
      )
    }
    return (
      <>
        {runs.map((run) => {
          const runHref = mobilePath(location.pathname, `/inspection/${run.id}`)
          return (
            <div key={run.id} className="mobileCard mobilePatrolCard">
              <div className="mobilePatrolCardTop">
                <div className="mobilePatrolCardTitle">{run.title}</div>
                <span className={`mobilePatrolRunStatus mobilePatrolRunStatus--${run.status === 'IN_PROGRESS' ? 'inprogress' : 'completed'}`}>
                  {runStatusLabel(run.status)}
                </span>
              </div>

              <div className="mobilePatrolCardMeta">
                <span>{run.location.name}</span>
                {run.location.city ? <span>· {run.location.city}</span> : null}
                {run.reportStatus ? (
                  <span className={`mobilePatrolReportBadge mobilePatrolReportBadge--${reportStatusMod(run.reportStatus)}`}>
                    {reportStatusLabel(run.reportStatus)}
                  </span>
                ) : null}
              </div>

              <div className="mobilePatrolCardMeta">
                <span>{fmtDate(run.createdAt)}</span>
                {run.template?.name ? <span>· {run.template.name}</span> : null}
                {run._count?.items > 0 ? <span>· {run._count.items} пунктов</span> : null}
              </div>

              <Link to={runHref} className="mobileBtn mobileBtnGhost" style={{ textAlign: 'center', marginTop: 2 }}>
                Открыть
              </Link>
            </div>
          )
        })}
      </>
    )
  })()

  if (standalone) {
    return (
      <div className="mobileSection">
        <div>
          <h1 className="mobileTitle">Обходы</h1>
          <div className="mobileSubtitle">Инспекционные обходы объектов</div>
        </div>
        {content}
      </div>
    )
  }

  return content
}
