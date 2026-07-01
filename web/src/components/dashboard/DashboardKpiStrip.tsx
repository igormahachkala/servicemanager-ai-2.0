import { DashboardMetricCard } from './DashboardMetricCard'
import { DASHBOARD_KPIS } from './mockData'

export function DashboardKpiStrip() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {DASHBOARD_KPIS.map((item) => (
        <DashboardMetricCard
          key={item.id}
          label={item.label}
          value={item.value}
          hint={item.hint}
          tone={item.tone}
        />
      ))}
    </div>
  )
}
