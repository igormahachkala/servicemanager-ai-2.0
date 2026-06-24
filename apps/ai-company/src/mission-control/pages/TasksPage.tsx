import { useMemo, useState } from 'react'
import {
  PageHeader,
  Panel,
  priorityBadgeClass,
  taskStatusLabel,
} from '../components/ui'
import { tasks } from '../data/mock'
import type { TaskStatus } from '../data/types'

const FILTERS: Array<{ id: 'all' | TaskStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'backlog', label: 'backlog' },
  { id: 'running', label: 'running' },
  { id: 'blocked', label: 'blocked' },
  { id: 'done', label: 'done' },
]

export function TasksPage() {
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')

  const rows = useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter((t) => t.status === filter)
  }, [filter])

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Company work queue — operational tasks with assignee, priority, and SLA."
      />

      <div className="mcChipRow">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? 'mcChip mcChipActive' : 'mcChip'}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Panel title="Task queue" right={<span className="mcMono mcMuted">{rows.length} items</span>}>
        <table className="mcTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="mcMono">{t.id}</td>
                <td>{t.title}</td>
                <td className="mcMono mcMuted">{t.assignee}</td>
                <td>
                  <span className={priorityBadgeClass(t.priority)}>{t.priority}</span>
                </td>
                <td className="mcMono">{taskStatusLabel(t.status)}</td>
                <td className="mcMono">
                  {t.status === 'done' ? (
                    '—'
                  ) : t.slaBreached ? (
                    <span style={{ color: 'var(--mc-red)' }}>breach</span>
                  ) : (
                    `${t.slaMinutes}m left`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}
