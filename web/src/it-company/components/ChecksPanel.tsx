export type MockCheck = {
  name: string
  status: 'pass' | 'fail' | 'running' | 'pending'
  detail?: string
  url?: string
}

const STATUS_ICON: Record<MockCheck['status'], string> = {
  pass: '✓',
  fail: '✕',
  running: '⟳',
  pending: '○',
}

const STATUS_COLOR: Record<MockCheck['status'], string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  running: '#d97706',
  pending: '#9ca3af',
}

const STATUS_BG: Record<MockCheck['status'], string> = {
  pass: '#f0fdf4',
  fail: '#fef2f2',
  running: '#fffbeb',
  pending: '#f9fafb',
}

const STATUS_BORDER: Record<MockCheck['status'], string> = {
  pass: '#bbf7d0',
  fail: '#fecaca',
  running: '#fde68a',
  pending: '#f3f4f6',
}

type Props = {
  checks: MockCheck[]
  collapsed: boolean
  onToggle: () => void
}

export function ChecksPanel({ checks, collapsed, onToggle }: Props) {
  const passed = checks.filter((c) => c.status === 'pass').length
  const failed = checks.filter((c) => c.status === 'fail').length
  const running = checks.filter((c) => c.status === 'running').length

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
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>⑤</span>
          <span>Checks</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {passed > 0 && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ {passed}</span>}
          {failed > 0 && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>✕ {failed}</span>}
          {running > 0 && <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⟳ {running}</span>}
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '10px 14px', display: 'grid', gap: 6 }}>
          {checks.map((check) => (
            <div
              key={check.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: STATUS_BG[check.status],
                border: `1px solid ${STATUS_BORDER[check.status]}`,
              }}
            >
              <span
                style={{
                  color: STATUS_COLOR[check.status],
                  fontSize: 13,
                  fontFamily: 'monospace',
                  flexShrink: 0,
                  width: 16,
                  textAlign: 'center',
                }}
              >
                {STATUS_ICON[check.status]}
              </span>
              <span style={{ fontSize: 13, color: '#111827', flex: 1, fontWeight: 500 }}>{check.name}</span>
              {check.detail && (
                <span style={{ fontSize: 12, color: STATUS_COLOR[check.status] }}>{check.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
