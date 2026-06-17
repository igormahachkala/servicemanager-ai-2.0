import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { AGENT_TASK_STATUS_COLOR, fmtDateTime } from '../components/agentTaskStatus'

const STATUS_LABEL: Record<api.AgentTaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  FAILED: 'Ошибка',
}

export function AIDeveloperPage() {
  const queryClient = useQueryClient()
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  const tasksQ = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: api.listAgentTasks,
    enabled: canView === true,
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
      setComposerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    },
    onError: (err: any) => setError(err?.message || String(err)),
  })

  // UI-доступ строго по роли. Backend guard остаётся источником истины для API.
  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Рабочее место AI Developer доступно только администратору платформы.</div>
      </div>
    )
  }

  const tasks = tasksQ.data || []

  return (
    <div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        <Link to="/it" style={{ color: 'inherit' }}>← IT Company</Link>
      </div>

      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>AI Developer</h2>
          <div className="muted small">
            Рабочее место цифрового разработчика. Задачи ставятся через AgentTask API.
          </div>
        </div>
        <button type="button" onClick={() => setComposerOpen((v) => !v)}>
          {composerOpen ? 'Скрыть форму' : 'Новая задача'}
        </button>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {tasksQ.isError ? <div className="alert">{(tasksQ.error as any)?.message || String(tasksQ.error)}</div> : null}

      {composerOpen ? (
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
                {createM.isPending ? 'Создаём…' : 'Создать задачу'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                <span className="tag" style={{ background: AGENT_TASK_STATUS_COLOR[task.status], color: '#fff' }}>
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
