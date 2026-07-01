import { DashboardSection } from './DashboardSection'
import { DASHBOARD_TEAM_LOAD } from './mockData'

export function DashboardTeamLoad() {
  return (
    <DashboardSection title="Team Load" eyebrow="Placeholder">
      <div style={{ display: 'grid', gap: 10 }}>
        {DASHBOARD_TEAM_LOAD.map((item) => (
          <div key={item.id} className="panel" style={{ background: '#f8fafc', minWidth: 0 }}>
            <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <div className="muted small">{item.role}</div>
              </div>
              <div style={{ fontWeight: 800 }}>{item.load}%</div>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              {item.note}
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
