import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

export function InspectionRunsPage() {
  const runsQ = useQuery({ queryKey: ['inspection-runs'], queryFn: api.getInspectionRuns })

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>История обходов</h2>
          <div className="muted small">Последние запуски обходов по вашей компании.</div>
        </div>
        <Link to="/inspection/templates"><button className="ghost">Новый обход</button></Link>
      </div>

      {runsQ.isError ? <div className="alert">{(runsQ.error as any)?.message || String(runsQ.error)}</div> : null}

      <div className="panel">
        {runsQ.isLoading ? <div className="muted">Загружаем обходы…</div> : null}
        <div style={{ display: 'grid', gap: 12 }}>
          {(runsQ.data || []).map((run) => (
            <div key={run.id} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{run.title}</div>
                  <div className="muted small">{run.template.name} · {run.location.name}{run.location.city ? ` · ${run.location.city}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="tag">{run.status}</span>
                  <Link to={'/inspection/runs/' + run.id}><button className="ghost">Открыть</button></Link>
                </div>
              </div>

              <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <div className="muted small">Локация</div>
                  <div>{run.location.name}</div>
                </div>
                <div>
                  <div className="muted small">Оборудование</div>
                  <div>{run.equipment?.name || '—'}</div>
                </div>
                <div>
                  <div className="muted small">Создан</div>
                  <div>{fmtDate(run.createdAt)}</div>
                </div>
                <div>
                  <div className="muted small">Завершён</div>
                  <div>{fmtDate(run.completedAt)}</div>
                </div>
              </div>
            </div>
          ))}
          {!runsQ.isLoading && (runsQ.data || []).length === 0 ? <div className="muted">Обходов пока нет.</div> : null}
        </div>
      </div>
    </div>
  )
}
