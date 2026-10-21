import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { ITCompanyDashboard } from '../dashboard'

export function ITCompanyPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  // UI-доступ строго по роли. Backend guard остаётся источником истины для API.
  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Раздел «ИТ-компания» доступен только администратору платформы.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>ИТ-компания</h2>
          <div className="muted small">
            Кабинет цифровых сотрудников. Первый сотрудник — ИИ-разработчик.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag">демо-данные</span>
          <Link to="/it/org-chart" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Структура</button>
          </Link>
          <Link to="/it/employees" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Цифровые сотрудники</button>
          </Link>
          <Link to="/it/tasks" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Задачи</button>
          </Link>
          <Link to="/it/mission-control" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Центр управления</button>
          </Link>
          <Link to="/it/ai-developer" style={{ textDecoration: 'none' }}>
            <button type="button">Открыть ИИ-разработчика</button>
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ITCompanyDashboard />
      </div>
    </div>
  )
}
