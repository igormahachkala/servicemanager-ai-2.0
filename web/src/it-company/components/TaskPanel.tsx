import type { AgentTaskStatus } from '../../lib/api'

export type MockTask = {
  id: string
  title: string
  prompt: string
  status: AgentTaskStatus
  createdAt: string
  updatedAt: string
}

const STATUS_COLOR: Record<AgentTaskStatus, string> = {
  NEW: '#2563eb',
  IN_PROGRESS: '#d97706',
  DONE: '#16a34a',
  FAILED: '#dc2626',
}

const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  FAILED: 'Ошибка',
}

const STATUS_DOT: Record<AgentTaskStatus, string> = {
  NEW: '○',
  IN_PROGRESS: '●',
  DONE: '✓',
  FAILED: '✕',
}

type Props = {
  task: MockTask
  collapsed: boolean
  onToggle: () => void
}

export function TaskPanel({ task, collapsed, onToggle }: Props) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f9fafb',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>①</span>
          <span>Задача</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 20,
              background: STATUS_COLOR[task.status],
              color: '#fff',
            }}
          >
            {STATUS_LABEL[task.status]}
          </span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#111827' }}>{task.title}</div>
          <div
            style={{
              fontSize: 13,
              color: '#374151',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            {task.prompt}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
            <span>Создана: {new Date(task.createdAt).toLocaleString('ru-RU')}</span>
            <span>Обновлена: {new Date(task.updatedAt).toLocaleString('ru-RU')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

type HistoryItemProps = {
  task: MockTask
  selected: boolean
  onClick: () => void
}

export function TaskHistoryItem({ task, selected, onClick }: HistoryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 8,
        background: selected ? '#eff6ff' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: STATUS_COLOR[task.status], fontSize: 14, marginTop: 1, flexShrink: 0 }}>
        {STATUS_DOT[task.status]}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: selected ? 600 : 400,
            color: selected ? '#1d4ed8' : '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {STATUS_LABEL[task.status]} · {new Date(task.updatedAt).toLocaleDateString('ru-RU')}
        </div>
      </div>
    </button>
  )
}
