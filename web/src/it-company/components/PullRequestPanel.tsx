export type MockPR = {
  title: string
  body: string
  branch: string
  baseBranch: string
  additions: number
  deletions: number
  filesChanged: number
  status: 'draft' | 'open' | 'merged' | 'closed'
  reviewers?: string[]
  labels?: string[]
}

const PR_STATUS_COLOR: Record<MockPR['status'], string> = {
  draft: '#6b7280',
  open: '#16a34a',
  merged: '#7c3aed',
  closed: '#dc2626',
}

const PR_STATUS_LABEL: Record<MockPR['status'], string> = {
  draft: 'Черновик',
  open: 'Открыт',
  merged: 'Смержен',
  closed: 'Закрыт',
}

type Props = {
  pr: MockPR
  collapsed: boolean
  onToggle: () => void
}

export function PullRequestPanel({ pr, collapsed, onToggle }: Props) {
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
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>⑥</span>
          <span>Draft PR</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 20,
              background: PR_STATUS_COLOR[pr.status],
              color: '#fff',
            }}
          >
            {PR_STATUS_LABEL[pr.status]}
          </span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, color: PR_STATUS_COLOR[pr.status], flexShrink: 0, marginTop: 1 }}>⊕</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>{pr.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  <code style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{pr.branch}</code>
                  {' → '}
                  <code style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{pr.baseBranch}</code>
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.6,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {pr.body}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="Файлы" value={String(pr.filesChanged)} />
            <Stat label="Добавлено" value={`+${pr.additions}`} color="#16a34a" />
            <Stat label="Удалено" value={`-${pr.deletions}`} color="#dc2626" />
          </div>

          {pr.labels && pr.labels.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {pr.labels.map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              Просмотреть PR
            </button>
            <button
              type="button"
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid #16a34a',
                background: '#f0fdf4',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
                color: '#16a34a',
              }}
            >
              Смержить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: color || '#111827', fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
    </div>
  )
}
