import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function runStatusLabel(status: api.InspectionRunStatus) {
  return status === 'IN_PROGRESS' ? 'В процессе' : 'Завершён'
}

function reportStatusLabel(status?: api.InspectionReportStatus | null) {
  if (status === 'DRAFT') return 'Черновик'
  if (status === 'SUBMITTED') return 'На проверке'
  if (status === 'APPROVED') return 'Утверждён'
  if (status === 'REJECTED') return 'Возвращён'
  return '—'
}

function personLabel(person?: api.InspectionRunPerson | null) {
  if (!person) return '—'
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return name || person.email
}

/**
 * 116F: длительность считается из тех же двух отметок, что уже есть в записи,
 * и показывается только когда обе надёжны. Незавершённый обход длительности
 * не имеет — прочерк честнее растущего счётчика.
 */
function durationLabel(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt || !completedAt) return '—'
  const from = new Date(startedAt).getTime()
  const to = new Date(completedAt).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return '—'
  const minutes = Math.round((to - from) / 60000)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

const EMPTY_FILTER: api.InspectionRunsFilter = {}

export function InspectionRunsPage() {
  const [filter, setFilter] = useState<api.InspectionRunsFilter>(EMPTY_FILTER)

  const runsQ = useQuery({
    queryKey: ['inspection-runs', filter],
    queryFn: () => api.getInspectionRuns(filter),
  })

  const runs = runsQ.data || []

  /**
   * Значения фильтров берутся из того, что уже пришло в истории: новых
   * справочников ради выпадающих списков задача не заводит. Список объектов и
   * исполнителей собирается по последней выдаче — этого достаточно, чтобы
   * сузить историю, и не требует отдельных запросов.
   */
  const locationOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const run of runs) byId.set(run.location.id, run.location.name)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [runs])

  const performerOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const run of runs) {
      if (run.performedBy) byId.set(run.performedBy.id, personLabel(run.performedBy))
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [runs])

  const activeFilters = Object.values(filter).filter((v) => v !== undefined && v !== '').length

  function patch(next: Partial<api.InspectionRunsFilter>) {
    setFilter((prev) => {
      const merged = { ...prev, ...next }
      for (const key of Object.keys(merged) as Array<keyof api.InspectionRunsFilter>) {
        if (merged[key] === undefined || merged[key] === '') delete merged[key]
      }
      return merged
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>История обходов</h2>
          <div className="muted small">Завершённые и текущие обходы по вашей компании.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/inspection/schedules"><button className="ghost">Планирование</button></Link>
          <Link to="/inspection/templates"><button className="ghost">Новый обход</button></Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Фильтры</div>
          {activeFilters ? (
            <button type="button" className="ghost" onClick={() => setFilter(EMPTY_FILTER)}>
              Сбросить ({activeFilters})
            </button>
          ) : null}
        </div>

        <div className="inspectionRunsFilters">
          <label>
            Объект
            <select
              value={filter.locationId || ''}
              onChange={(e) => patch({ locationId: e.target.value || undefined })}
            >
              <option value="">Все объекты</option>
              {locationOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>

          <label>
            Исполнитель
            <select
              value={filter.performedByUserId || ''}
              onChange={(e) => patch({ performedByUserId: e.target.value || undefined })}
            >
              <option value="">Все исполнители</option>
              {performerOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>

          <label>
            Статус обхода
            <select
              value={filter.status || ''}
              onChange={(e) => patch({ status: (e.target.value || undefined) as api.InspectionRunStatus | undefined })}
            >
              <option value="">Любой</option>
              <option value="IN_PROGRESS">В процессе</option>
              <option value="COMPLETED">Завершён</option>
            </select>
          </label>

          <label>
            Статус акта
            <select
              value={filter.reportStatus || ''}
              onChange={(e) => patch({ reportStatus: (e.target.value || undefined) as api.InspectionReportStatus | undefined })}
            >
              <option value="">Любой</option>
              <option value="DRAFT">Черновик</option>
              <option value="SUBMITTED">На проверке</option>
              <option value="APPROVED">Утверждён</option>
              <option value="REJECTED">Возвращён</option>
            </select>
          </label>

          <label>
            Начат с
            <input type="date" value={filter.from?.slice(0, 10) || ''} onChange={(e) => patch({ from: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </label>

          <label>
            Начат по
            <input
              type="date"
              value={filter.to?.slice(0, 10) || ''}
              onChange={(e) => {
                if (!e.target.value) return patch({ to: undefined })
                const end = new Date(e.target.value)
                end.setHours(23, 59, 59, 999)
                patch({ to: end.toISOString() })
              }}
            />
          </label>
        </div>
      </div>

      {runsQ.isError ? <div className="alert">{(runsQ.error as any)?.message || String(runsQ.error)}</div> : null}

      <div className="panel">
        {runsQ.isLoading ? <div className="muted">Загружаем обходы…</div> : null}
        <div style={{ display: 'grid', gap: 12 }}>
          {runs.map((run) => {
            const completed = run.status === 'COMPLETED'
            return (
              <div key={run.id} className="card inspectionRunCard">
                <div className="row" style={{ marginBottom: 8 }}>
                  <div>
                    {/* Снимок названия на момент запуска, не живое имя шаблона. */}
                    <div style={{ fontWeight: 700 }}>{run.title}</div>
                    <div className="muted small">
                      {run.location.name}{run.location.city ? ` · ${run.location.city}` : ''}
                      {run.equipment?.name ? ` · ${run.equipment.name}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag">{runStatusLabel(run.status)}</span>
                    {run.reportStatus ? <span className="tag">Акт: {reportStatusLabel(run.reportStatus)}</span> : null}
                    <Link to={'/inspection/runs/' + run.id}><button className="ghost">Открыть</button></Link>
                    {completed ? (
                      <Link to={`/inspection/runs/${run.id}/report`}><button className="ghost">Итог обхода</button></Link>
                    ) : null}
                  </div>
                </div>

                <div className="inspectionRunMetaGrid">
                  <div>
                    <div className="muted small">Исполнитель</div>
                    <div>{personLabel(run.performedBy)}</div>
                  </div>
                  <div>
                    <div className="muted small">Начат</div>
                    <div>{fmtDateTime(run.createdAt)}</div>
                  </div>
                  <div>
                    <div className="muted small">Завершён</div>
                    <div>{fmtDateTime(run.completedAt)}</div>
                  </div>
                  <div>
                    <div className="muted small">Длительность</div>
                    <div>{durationLabel(run.createdAt, run.completedAt)}</div>
                  </div>
                </div>

                <div className="inspectionRunSummaryRow">
                  <span>Пунктов: <b>{run.summary.totalItems}</b></span>
                  <span>Норма: <b>{run.summary.okCount}</b></span>
                  <span>Проблема: <b>{run.summary.issueCount}</b></span>
                  <span>Критично: <b>{run.summary.criticalCount}</b></span>
                  {run.summary.pendingCount ? <span>Не заполнено: <b>{run.summary.pendingCount}</b></span> : null}
                  <span>Заявок создано: <b>{run.summary.createdTicketsCount}</b></span>
                </div>

                {run.reportStatus === 'APPROVED' || run.reportStatus === 'REJECTED' ? (
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {run.reportStatus === 'APPROVED' ? 'Утвердил' : 'Вернул'}: {personLabel(run.reportReviewedBy)} · {fmtDateTime(run.reportReviewedAt)}
                  </div>
                ) : null}
              </div>
            )
          })}
          {!runsQ.isLoading && runs.length === 0 ? (
            <div className="muted">{activeFilters ? 'По выбранным фильтрам обходов нет.' : 'Обходов пока нет.'}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
