import { DashboardSection } from './DashboardSection'
import { DASHBOARD_TEAM_LOAD } from './mockData'

export function TeamLoadCard() {
  const totalLoad = DASHBOARD_TEAM_LOAD.reduce((sum, item) => sum + item.load, 0)
  const averageLoad = Math.round(totalLoad / DASHBOARD_TEAM_LOAD.length)

  const summaryItems = [
    { label: 'Active team', value: String(DASHBOARD_TEAM_LOAD.length), tone: '#2563eb' },
    { label: 'Average load', value: `${averageLoad}%`, tone: '#0f766e' },
    { label: 'Top load', value: `${Math.max(...DASHBOARD_TEAM_LOAD.map((item) => item.load))}%`, tone: '#d97706' },
  ]

  return (
    <DashboardSection
      title="Team Load"
      eyebrow="Capacity board"
      action={
        <span className="tag" style={{ background: '#ecfeff', borderColor: '#a5f3fc', color: '#155e75' }}>
          Staffing snapshot
        </span>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div
          className="panel"
          style={{
            minWidth: 0,
            display: 'grid',
            gap: 12,
            padding: 16,
            borderColor: '#dbe4f0',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
              Team summary
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Текущая загрузка команды стабильна, но основной фокус остаётся на runtime и delivery follow-up.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 10,
            }}
          >
            {summaryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  minWidth: 0,
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${item.tone}30`,
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 8, fontSize: '1.15rem', fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
            Team members
          </div>
        {DASHBOARD_TEAM_LOAD.map((item) => (
          <div
            key={item.id}
            className="panel"
            style={{
              minWidth: 0,
              padding: 16,
              borderColor: item.load >= 75 ? '#fdba74' : item.load >= 55 ? '#bfdbfe' : '#bbf7d0',
              background:
                item.load >= 75
                  ? 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)'
                  : item.load >= 55
                    ? 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)'
                    : 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.name}</div>
                  <div className="muted small">{item.role}</div>
                </div>
                <div style={{ fontWeight: 900, color: '#0f172a' }}>{item.load}%</div>
              </div>

              <div
                aria-hidden
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.load}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: item.load >= 75 ? '#f59e0b' : item.load >= 55 ? '#2563eb' : '#16a34a',
                  }}
                />
              </div>

              <div className="muted small" style={{ lineHeight: 1.55 }}>
                {item.note}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </DashboardSection>
  )
}
