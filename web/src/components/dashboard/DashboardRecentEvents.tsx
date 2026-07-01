import { DashboardSection } from './DashboardSection'
import { DASHBOARD_EVENTS } from './mockData'

const TONE_COLOR: Record<'blue' | 'green' | 'amber' | 'red', string> = {
  blue: '#2563eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
}

export function DashboardRecentEvents() {
  return (
    <DashboardSection title="Recent Events" eyebrow="Timeline">
      <div style={{ display: 'grid', gap: 12 }}>
        {DASHBOARD_EVENTS.map((event) => (
          <div key={event.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                marginTop: 6,
                flex: '0 0 auto',
                background: TONE_COLOR[event.tone as keyof typeof TONE_COLOR],
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{event.title}</div>
              <div className="muted small" style={{ marginTop: 2 }}>
                {event.description}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {event.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
