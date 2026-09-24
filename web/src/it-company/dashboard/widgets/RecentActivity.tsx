import { DashboardSection } from '../components/DashboardSection'
import { DASHBOARD_TONE_COLOR } from '../components/DashboardMetricCard'
import { RECENT_ACTIVITY } from '../mockData'

/** Recent activity feed section. */
export function RecentActivity() {
  return (
    <DashboardSection title="Последняя активность">
      <div style={{ display: 'grid', gap: 10 }}>
        {RECENT_ACTIVITY.map((item) => (
          <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                marginTop: 6,
                width: 8,
                height: 8,
                borderRadius: 999,
                flex: '0 0 auto',
                background: DASHBOARD_TONE_COLOR[item.tone ?? 'slate'],
              }}
            />
            <div>
              <div className="small">{item.text}</div>
              <div className="muted small">{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
