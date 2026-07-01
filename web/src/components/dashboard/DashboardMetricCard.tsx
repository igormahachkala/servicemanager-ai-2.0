export type DashboardTone = 'blue' | 'green' | 'amber' | 'red'

const TONE: Record<DashboardTone, { color: string; bg: string; border: string }> = {
  blue: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  green: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  amber: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  red: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

export function DashboardMetricCard(props: {
  label: string
  value: string
  hint: string
  tone: DashboardTone
}) {
  const tone = TONE[props.tone]
  return (
    <div
      className="panel"
      style={{
        minWidth: 0,
        borderColor: tone.border,
        background: tone.bg,
      }}
    >
      <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: 800, color: tone.color }}>{props.value}</div>
      <div style={{ marginTop: 8, fontWeight: 700 }}>{props.label}</div>
      <div className="muted small" style={{ marginTop: 4 }}>
        {props.hint}
      </div>
    </div>
  )
}
