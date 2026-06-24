import { useMemo, useState } from 'react'
import {
  PageHeader,
  Panel,
  priorityBadgeClass,
} from '../components/ui'
import { tasks } from '../data/mock'
import type { TaskStatus } from '../data/types'
import { useI18n } from '../../i18n'

export function TasksPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')

  const filters: Array<{ id: 'all' | TaskStatus; label: string }> = [
    { id: 'all', label: t.common.all },
    { id: 'backlog', label: t.taskStatus.backlog },
    { id: 'running', label: t.taskStatus.running },
    { id: 'blocked', label: t.taskStatus.blocked },
    { id: 'done', label: t.taskStatus.done },
  ]

  const rows = useMemo(() => {
    if (filter === 'all') return tasks
    return tasks.filter((task) => task.status === filter)
  }, [filter])

  return (
    <>
      <PageHeader title={t.pages.tasks} description={t.tasks.description} />

      <div className="mcChipRow">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'mcChip mcChipActive' : 'mcChip'}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Panel
        title={t.tasks.queue}
        right={
          <span className="mcMono mcMuted">
            {rows.length} {t.tools.items}
          </span>
        }
      >
        <table className="mcTable">
          <thead>
            <tr>
              <th>{t.labels.id}</th>
              <th>{t.labels.title}</th>
              <th>{t.labels.assignee}</th>
              <th>{t.labels.priority}</th>
              <th>{t.labels.status}</th>
              <th>{t.labels.sla}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => (
              <tr key={task.id}>
                <td className="mcMono">{task.id}</td>
                <td>{task.title}</td>
                <td className="mcMono mcMuted">{task.assignee}</td>
                <td>
                  <span className={priorityBadgeClass(task.priority)}>{task.priority}</span>
                </td>
                <td className="mcMono">{t.taskStatus[task.status]}</td>
                <td className="mcMono">
                  {task.status === 'done' ? (
                    t.common.empty
                  ) : task.slaBreached ? (
                    <span style={{ color: 'var(--mc-red)' }}>{t.tasks.slaBreach}</span>
                  ) : (
                    t.tasks.slaLeft.replace('{minutes}', String(task.slaMinutes))
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
