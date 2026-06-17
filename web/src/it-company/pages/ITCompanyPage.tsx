import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { AGENT_TASK_STATUS_COLOR } from '../components/agentTaskStatus'

const STATUS_LABEL: Record<api.AgentTaskStatus, string> = {
  NEW: 'Новые',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  FAILED: 'Ошибки',
}

const STATUS_ORDER: api.AgentTaskStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'FAILED']

export function ITCompanyPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  const tasksQ = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: api.listAgentTasks,
    enabled: canView === true,
  })

  const tasks = useMemo(() => tasksQ.data || [], [tasksQ.data])

  const counts = useMemo(() => {
    const base: Record<api.AgentTaskStatus, number> = { NEW: 0, IN_PROGRESS: 0, DONE: 0, FAILED: 0 }
    for (const task of tasks) base[task.status] += 1
    return base
  }, [tasks])

  // Простой производный статус агента из задач (нет отдельного API статуса агента).
  const agentStatus = counts.IN_PROGRESS > 0
    ? { label: 'В работе', color: '#d97706' }
    : { label: 'Свободен', color: '#16a34a' }

  // UI-доступ строго по роли. Backend guard остаётся источником истины для API.
  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
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
          <h2 style={{ marginBottom: 4 }}>IT Company</h2>
          <div className="muted small">
            Кабинет цифровых сотрудников. Первый сотрудник — AI Developer.
          </div>
        </div>
        <span className="tag">PLATFORM_ADMIN</span>
      </div>

      {tasksQ.isError ? (
        <div className="alert">{(tasksQ.error as any)?.message || String(tasksQ.error)}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <div className="panel">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>AI Developer</div>
              <div className="muted small" style={{ marginTop: 2 }}>
                Цифровой разработчик. Принимает задачи, анализирует проект и возвращает отчёт.
              </div>
            </div>
            <span className="tag" style={{ background: agentStatus.color, color: '#fff' }}>
              {agentStatus.label}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="card"
                style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 12, textAlign: 'center' }}
              >
                <div style={{ fontWeight: 700, fontSize: 20, color: AGENT_TASK_STATUS_COLOR[status] }}>
                  {tasksQ.isLoading ? '…' : counts[status]}
                </div>
                <div className="muted small">{STATUS_LABEL[status]}</div>
              </div>
            ))}
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            Всего задач: {tasksQ.isLoading ? '…' : tasks.length}
          </div>

          <div style={{ marginTop: 12 }}>
            <Link to="/it/ai-developer" style={{ textDecoration: 'none' }}>
              <button type="button">Открыть AI Developer</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
