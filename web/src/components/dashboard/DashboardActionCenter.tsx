import { Link } from 'react-router-dom'
import { DashboardSection } from './DashboardSection'
import { DASHBOARD_ACTIONS } from './mockData'

export function DashboardActionCenter() {
  return (
    <DashboardSection title="Action Center" eyebrow="Dashboard V2">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {DASHBOARD_ACTIONS.map((action) => (
          <div key={action.id} className="panel" style={{ minWidth: 0, background: '#f8fafc' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{action.title}</div>
            <div className="muted small" style={{ minHeight: 40 }}>
              {action.description}
            </div>
            <div style={{ marginTop: 12 }}>
              <Link to={action.to} className="mcBtn mcBtnSecondary mcBtnSmall">
                {action.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
