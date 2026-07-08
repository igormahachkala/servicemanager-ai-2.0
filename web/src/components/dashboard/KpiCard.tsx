import type { ReactNode } from 'react'

export type KpiTone = 'blue' | 'green' | 'amber' | 'red'

const KPI_TONES: Record<KpiTone, { color: string; bg: string; border: string }> = {
  blue: { color: '#1d4ed8', bg: 'linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%)', border: '#bfdbfe' },
  green: { color: '#15803d', bg: 'linear-gradient(180deg, #f7fef9 0%, #f0fdf4 100%)', border: '#bbf7d0' },
  amber: { color: '#b45309', bg: 'linear-gradient(180deg, #fffdf7 0%, #fffbeb 100%)', border: '#fde68a' },
  red: { color: '#dc2626', bg: 'linear-gradient(180deg, #fff7f7 0%, #fef2f2 100%)', border: '#fecaca' },
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
        display: 'grid',
        gap: 14,
        padding: 18,
        borderColor: tone.border,
        background: tone.bg,
        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div
          style={{
            minWidth: 0,
            color: '#475569',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {props.label}
        </div>
        <span
          className="tag"
          style={{
            flex: '0 0 auto',
            background: `${tone.color}12`,
            borderColor: `${tone.color}2e`,
            color: tone.color,
            fontWeight: 700,
          }}
        >
          Live
        </span>
      </div>
      <div style={{ fontSize: '2.35rem', lineHeight: 0.95, fontWeight: 900, color: tone.color, letterSpacing: '-0.05em' }}>
        {props.value}
      </div>
      <div className="muted small" style={{ color: '#475569', lineHeight: 1.5 }}>
        {props.hint}
      </div>
    </div>
  )
}
