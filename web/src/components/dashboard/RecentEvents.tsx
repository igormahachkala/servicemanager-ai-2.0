import { DashboardSection } from './DashboardSection'
import { DASHBOARD_EVENTS } from './mockData'

const TONE_COLOR = {
  blue: '#2563eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
} as const

export function RecentEvents() {
  return (
    <DashboardSection
      title="Recent Events"
      eyebrow="Operations feed"
      action={
        <span className="tag" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
          {DASHBOARD_EVENTS.length} signals
        </span>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {DASHBOARD_EVENTS.map((event, index) => (
          <div
            key={event.id}
            className="panel"
            style={{
              minWidth: 0,
              padding: index === 0 ? 16 : 14,
              borderColor: `${TONE_COLOR[event.tone]}30`,
              background:
                index === 0
                  ? `linear-gradient(180deg, ${TONE_COLOR[event.tone]}12 0%, #ffffff 100%)`
                  : '#fff',
              boxShadow: index === 0 ? '0 18px 30px rgba(15, 23, 42, 0.08)' : undefined,
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 0, alignItems: 'flex-start' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      marginTop: 4,
                      flex: '0 0 auto',
                      background: TONE_COLOR[event.tone],
                      boxShadow: `0 0 0 5px ${TONE_COLOR[event.tone]}14`,
                    }}
                  />
                  <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {index === 0 ? (
                        <span
                          className="tag"
                          style={{ background: '#f8fafc', borderColor: '#dbe4f0', color: '#0f172a', fontWeight: 800 }}
                        >
                          Latest
                        </span>
                      ) : null}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: TONE_COLOR[event.tone],
                        }}
                      >
                        {event.tone} signal
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>{event.title}</div>
                  </div>
                </div>

                <div
                  style={{
                    flex: '0 0 auto',
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.time}
                </div>
              </div>

              <div
                className="muted small"
                style={{
                  lineHeight: 1.55,
                  paddingLeft: 24,
                }}
              >
                {event.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
