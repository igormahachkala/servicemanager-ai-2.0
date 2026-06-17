import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { AI_EMPLOYEES, countByStatus, type AIEmployeeStatus } from '../employees'

function statusStyle(status: AIEmployeeStatus): React.CSSProperties {
  return status === 'Active'
    ? { background: '#16a34a', color: '#fff' }
    : { background: '#e5e7eb', color: '#374151' }
}

export function AIEmployeesPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  // UI-доступ строго по роли. Backend guard остаётся источником истины для API.
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Раздел IT Company доступен только администратору платформы.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>AI Employees</h2>
          <div className="muted small">
            Реестр цифровых сотрудников IT Company: {countByStatus('Active')} активны,{' '}
            {countByStatus('Planned')} запланированы.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag">демо-данные</span>
          <Link to="/it" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">← IT Company</button>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {AI_EMPLOYEES.map((e) => (
          <div
            key={e.id}
            className="card"
            style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 12 }}
          >
            <div className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>
                {e.role}
                {e.codename ? <span className="muted" style={{ fontWeight: 400 }}> · {e.codename}</span> : null}
              </div>
              <span className="tag" style={statusStyle(e.status)}>{e.status}</span>
            </div>
            <div className="muted small">{e.mission}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
