import type { ReactNode } from 'react'

export type KpiTone = 'blue' | 'green' | 'amber' | 'red'

const KPI_TONES: Record<KpiTone, { color: string; bg: string; border: string }> = {
  blue: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  green: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  amber: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  red: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

export function KpiCard(props: {
  label: string
  value: ReactNode
  hint: string
  tone: KpiTone
}) {
  const tone = KPI_TONES[props.tone]

  return (
    <div
      className="panel"
      style={{
        minWidth: 0,
        borderColor: tone.border,
        background: tone.bg,
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.02)',
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
