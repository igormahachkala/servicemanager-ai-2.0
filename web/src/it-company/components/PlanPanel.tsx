export type MockPlanStep = {
  id: number
  text: string
  status: 'done' | 'in_progress' | 'pending'
  files?: string[]
  detail?: string
}

const STEP_ICON: Record<MockPlanStep['status'], string> = {
  done: '✓',
  in_progress: '◉',
  pending: '○',
}

const STEP_COLOR: Record<MockPlanStep['status'], string> = {
  done: '#16a34a',
  in_progress: '#d97706',
  pending: '#9ca3af',
}

type Props = {
  steps: MockPlanStep[]
  collapsed: boolean
  onToggle: () => void
}

export function PlanPanel({ steps, collapsed, onToggle }: Props) {
  const doneCount = steps.filter((s) => s.status === 'done').length
  const total = steps.length

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
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>②</span>
          <span>Plan</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {doneCount}/{total} шагов
          </span>
          <ProgressBar done={doneCount} total={total} />
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 6 }}>
          {steps.map((step, idx) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: step.status === 'in_progress' ? '#fffbeb' : 'transparent',
                border: step.status === 'in_progress' ? '1px solid #fde68a' : '1px solid transparent',
              }}
            >
              <span
                style={{
                  color: STEP_COLOR[step.status],
                  fontSize: 14,
                  marginTop: 1,
                  flexShrink: 0,
                  fontFamily: 'monospace',
                }}
              >
                {STEP_ICON[step.status]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: step.status === 'done' ? '#6b7280' : '#111827',
                    textDecoration: step.status === 'done' ? 'line-through' : 'none',
                    fontWeight: step.status === 'in_progress' ? 600 : 400,
                  }}
                >
                  <span style={{ color: '#9ca3af', marginRight: 6, fontFamily: 'monospace', fontSize: 11 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {step.text}
                </div>
                {step.detail && step.status === 'in_progress' && (
                  <div style={{ fontSize: 12, color: '#92400e', marginTop: 3, fontStyle: 'italic' }}>
                    {step.detail}
                  </div>
                )}
                {step.files && step.status === 'done' && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {step.files.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '1px 6px',
                          borderRadius: 4,
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {step.status === 'in_progress' && (
                <span style={{ fontSize: 12, color: '#d97706', animation: 'none' }}>⟳</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div style={{ width: 60, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s' }} />
    </div>
  )
}
