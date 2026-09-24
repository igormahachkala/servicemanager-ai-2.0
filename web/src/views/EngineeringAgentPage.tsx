import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

const STATUS_LABEL: Record<api.AgentTaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  FAILED: 'Ошибка',
}

const STATUS_COLOR: Record<api.AgentTaskStatus, string> = {
  NEW: '#2563eb',
  IN_PROGRESS: '#d97706',
  DONE: '#16a34a',
  FAILED: '#dc2626',
}

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

export function EngineeringAgentPage() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canAccess = meQ.data?.canAccessEngineeringAgent

  const tasksQ = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: api.listAgentTasks,
    enabled: canAccess === true,
  })

  const createM = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim()
      const trimmedPrompt = prompt.trim()
      if (!trimmedTitle) throw new Error('Укажите название задачи')
      if (!trimmedPrompt) throw new Error('Опишите задачу для агента')
      return api.createAgentTask({ title: trimmedTitle, prompt: trimmedPrompt })
    },
    onSuccess: async () => {
      setError(null)
      setTitle('')
      setPrompt('')
      await queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    },
    onError: (err: any) => setError(err?.message || String(err)),
  })

  // Defense-in-depth: backend guard is the real enforcement; this just avoids
  // rendering the module UI to a non-owner who reached the route directly.
  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  if (canAccess !== true) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">У вас нет доступа к этому модулю.</div>
      </div>
    )
  }

  const tasks = tasksQ.data || []

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Engineering Agent</h2>
          <div className="muted small">
            Постановка задач цифровому разработчику. MVP: задачи только сохраняются — код не выполняется.
          </div>
        </div>
        <span className="tag">v0.1 · owner-only</span>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {tasksQ.isError ? <div className="alert">{(tasksQ.error as any)?.message || String(tasksQ.error)}</div> : null}

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Новая задача</h3>
        <div className="form">
          <label>
            Название
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Добавить экспорт акта в PDF"
            />
          </label>
          <label>
            Задача для агента
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Опишите, что нужно сделать цифровому разработчику…"
            />
          </label>
          <div>
            <button type="button" onClick={() => createM.mutate()} disabled={createM.isPending}>
              {createM.isPending ? 'Создаём…' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Задачи</h3>
          {!tasksQ.isLoading ? <div className="muted small">Всего: {tasks.length}</div> : null}
        </div>

        {tasksQ.isLoading ? <div className="muted">Загружаем задачи…</div> : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {tasks.map((task) => (
            <div key={task.id} className="card" style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <div className="row" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{task.title}</div>
                <span className="tag" style={{ background: STATUS_COLOR[task.status], color: '#fff' }}>
                  {STATUS_LABEL[task.status]}
                </span>
              </div>

              <div className="muted small" style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{task.prompt}</div>

              {task.result ? (
                <div className="panel" style={{ padding: 10, marginBottom: 8 }}>
                  <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>Ответ агента</div>
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{task.result}</div>
                </div>
              ) : null}

              <div className="muted small" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>Создано: {fmtDateTime(task.createdAt)}</span>
                <span>Обновлено: {fmtDateTime(task.updatedAt)}</span>
              </div>
            </div>
          ))}

          {!tasksQ.isLoading && tasks.length === 0 ? (
            <div className="muted">Задач пока нет. Создайте первую задачу для агента.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
