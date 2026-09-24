import type { ReactNode } from 'react'

/** Visual tone for dashboard metric cards. Maps to the app's color palette. */
export type DashboardTone = 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'slate'

export const DASHBOARD_TONE_COLOR: Record<DashboardTone, string> = {
  blue: '#2563eb',
  amber: '#d97706',
  green: '#16a34a',
  red: '#dc2626',
  violet: '#7c3aed',
  slate: '#475569',
}

/** Generic metric card for the IT Company dashboard: a big value + label + hint. */
export function DashboardMetricCard(props: { label: string; value: ReactNode; tone?: DashboardTone; hint?: string }) {
  const color = DASHBOARD_TONE_COLOR[props.tone ?? 'slate']
  return (
    <div className="card" style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 24, color }}>{props.value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{props.label}</div>
      {props.hint ? <div className="muted small" style={{ marginTop: 6, opacity: 0.8 }}>{props.hint}</div> : null}
    </div>
  )
}
