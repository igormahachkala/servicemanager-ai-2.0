import { StatCardsRow } from './widgets/StatCardsRow'
import { TodayPanel } from './widgets/TodayPanel'
import { RecentActivity } from './widgets/RecentActivity'
import { TopEmployees } from './widgets/TopEmployees'

/**
 * IT Company dashboard — the first real screen of the module.
 *
 * Composition only; all numbers come from `mockData` (demo content). No backend,
 * no AgentTask API, no live queries — real data wiring is a later task.
 */
export function ITCompanyDashboard() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <StatCardsRow />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        <TodayPanel />
        <RecentActivity />
        <TopEmployees />
      </div>
    </div>
  )
}
