import { DashboardMetricCard } from '../components/DashboardMetricCard'
import { DASHBOARD_STATS } from '../mockData'

/** The top row of metric cards (Employees / Active Tasks / Waiting Review / Failed / Open PRs). */
export function StatCardsRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
      }}
    >
      {DASHBOARD_STATS.map((stat) => (
        <DashboardMetricCard key={stat.id} label={stat.label} value={stat.value} tone={stat.tone} hint={stat.hint} />
      ))}
    </div>
  )
}
