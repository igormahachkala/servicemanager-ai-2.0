import {
  DashboardAcceptanceQueue,
  DashboardActionCenter,
  DashboardKpiStrip,
  DashboardRecentEvents,
  DashboardTeamLoad,
} from '../components/dashboard'

export function DashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
      <header className="panel" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Management Console V2
            </div>
            <h1 style={{ margin: '4px 0 0' }}>Dashboard V2</h1>
            <div className="muted" style={{ marginTop: 6, maxWidth: 760 }}>
              Каркас главного экрана: KPI Strip, Action Center, Recent Events, Team Load и Acceptance Queue.
              Только layout и mock data, без бизнес-логики и API.
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            <span className="tag">layout only</span>
            <span className="tag">mock data</span>
            <span className="tag">Shell</span>
          </div>
        </div>
      </header>

      <DashboardKpiStrip />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <DashboardActionCenter />
          <DashboardRecentEvents />
        </div>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <DashboardTeamLoad />
          <DashboardAcceptanceQueue />
        </div>
      </div>
    </div>
  )
}
