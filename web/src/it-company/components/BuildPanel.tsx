export type BuildStep = {
  name: string
  status: 'pass' | 'fail' | 'running' | 'pending'
  duration?: string
  detail?: string
}

export type MockBuild = {
  status: 'pass' | 'fail' | 'running' | 'pending'
  branch: string
  commit?: string
  duration?: string
  steps: BuildStep[]
}

const STATUS_ICON: Record<BuildStep['status'], string> = {
  pass: '✓',
  fail: '✕',
  running: '⟳',
  pending: '○',
}

const STATUS_COLOR: Record<BuildStep['status'], string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  running: '#d97706',
  pending: '#9ca3af',
}

const BUILD_LABEL: Record<MockBuild['status'], string> = {
  pass: 'Сборка прошла',
  fail: 'Сборка упала',
  running: 'Собирается…',
  pending: 'Ожидает',
}

type Props = {
  build: MockBuild
  collapsed: boolean
  onToggle: () => void
}

export function BuildPanel({ build, collapsed, onToggle }: Props) {
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
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>④</span>
          <span>Build Status</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: STATUS_COLOR[build.status], fontSize: 14 }}>{STATUS_ICON[build.status]}</span>
          <span style={{ fontSize: 12, color: STATUS_COLOR[build.status], fontWeight: 600 }}>
            {BUILD_LABEL[build.status]}
          </span>
          {build.duration && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{build.duration}</span>
          )}
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: '#6b7280' }}>
              Ветка: <code style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{build.branch}</code>
            </span>
            {build.commit && (
              <span style={{ color: '#6b7280' }}>
                Коммит: <code style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{build.commit}</code>
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gap: 4 }}>
            {build.steps.map((step) => (
              <div
                key={step.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: step.status === 'running' ? '#fffbeb' : '#f9fafb',
                  border: `1px solid ${step.status === 'running' ? '#fde68a' : '#f3f4f6'}`,
                }}
              >
                <span style={{ color: STATUS_COLOR[step.status], fontFamily: 'monospace', fontSize: 13, flexShrink: 0 }}>
                  {STATUS_ICON[step.status]}
                </span>
                <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{step.name}</span>
                {step.duration && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{step.duration}</span>
                )}
                {step.detail && (
                  <span style={{ fontSize: 12, color: STATUS_COLOR[step.status] }}>{step.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
