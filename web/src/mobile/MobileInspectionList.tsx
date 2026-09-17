import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

/** Иконка-плитка обхода (Tabler clipboard-check, тон по статусу) — Figma PatrolsScreen. */
function PatrolClipboardIcon({ tone }: { tone: string }) {
  return (
    <span className={`mobilePatrolIcon mobilePatrolIcon--${tone}`} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3l8 -8" />
        <path d="M20 12v6a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2h9" />
      </svg>
    </span>
  )
}

/** Tabler arrow-left — inline SVG вместо глифа ←. */
function BackArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

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

  // SMA-PATROLS-005: история обходов конкретного объекта (/m/inspection/object/:locationId).
  const params = useParams<{ locationId?: string }>()
  const objectLocationId = (params.locationId || '').trim()
  const isObjectHistory = !!objectLocationId

  /**
   * 116F: объект отбирается запросом, а не фильтрацией последних 50 записей на
   * клиенте — иначе история объекта обрывалась, как только по компании набегало
   * больше полусотни обходов.
   */
  const runsFilter = useMemo(
    () => (isObjectHistory ? { locationId: objectLocationId, limit: 20 } : {}),
    [isObjectHistory, objectLocationId],
  )

  const runsQ = useQuery({
    queryKey: ['inspection-runs', runsFilter],
    queryFn: () => api.getInspectionRuns(runsFilter),
  })

  const objectRuns = useMemo(() => {
    if (!isObjectHistory) return []
    return (runsQ.data || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [runsQ.data, isObjectHistory])

  if (isObjectHistory) {
    const objectName = objectRuns[0]?.location?.name || 'Объект'
    return (
      <div className="mobileSection">
        <div className="mobileTicketDetailsToolbar">
          <Link to={mobilePath(location.pathname, '/inspection')} className="mobileDetailsBackLink mobilePatrolBackLink"><BackArrow />Обходы</Link>
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
          objectRuns.map((run) => {
            const violations = run.summary.issueCount + run.summary.criticalCount
            const tickets = run.summary.createdTicketsCount
            const pb = run.performedBy
            const performer = pb
              ? ([pb.firstName, pb.lastName].filter(Boolean).join(' ').trim() || pb.email)
              : '—'
            return (
              <div key={run.id} className="mobileCard mobilePatrolCard">
                <div className="mobilePatrolCardTop">
                  <PatrolClipboardIcon tone={run.status === 'IN_PROGRESS' ? 'inprogress' : 'completed'} />
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
                  <span>Нарушений: {violations}</span>
                  <span>· Заявок создано: {tickets}</span>
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
            Нажмите «Начать обход», выберите тип и доступную локацию.
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
                <PatrolClipboardIcon tone={run.status === 'IN_PROGRESS' ? 'inprogress' : 'completed'} />
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
                <span>· {run._count?.items ?? run.summary.totalItems} пунктов</span>
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
        <div className="mobileInspectionListHeader">
          <div>
            <h1 className="mobileTitle">Обходы</h1>
            <div className="mobileSubtitle">Инспекционные обходы объектов</div>
          </div>
          <Link
            to={`${mobilePath(location.pathname, '/inspection/start')}${location.search}`}
            className="mobileBtn mobileInspectionStartLink"
          >
            Начать обход
          </Link>
        </div>
        {content}
      </div>
    )
  }

  return content
}
