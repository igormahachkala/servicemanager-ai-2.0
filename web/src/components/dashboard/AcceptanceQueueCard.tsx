import { DashboardSection } from './DashboardSection'
import { DASHBOARD_ACCEPTANCE_QUEUE } from './mockData'

type AcceptanceStatus = 'awaiting_acceptance' | 'blocked' | 'needs_review'

const BADGE_STYLE: Record<AcceptanceStatus, string> = {
  awaiting_acceptance: '#f59e0b',
  blocked: '#dc2626',
  needs_review: '#2563eb',
}

const STATUS_LABEL: Record<AcceptanceStatus, string> = {
  awaiting_acceptance: 'Awaiting acceptance',
  blocked: 'Blocked',
  needs_review: 'Needs review',
}

export function AcceptanceQueueCard() {
  const summaryItems: Array<{ status: AcceptanceStatus; label: string }> = [
    { status: 'blocked', label: 'Blocked' },
    { status: 'needs_review', label: 'Needs review' },
    { status: 'awaiting_acceptance', label: 'Waiting client' },
  ]

  const counts = DASHBOARD_ACCEPTANCE_QUEUE.reduce<Record<AcceptanceStatus, number>>(
    (acc, item) => {
      const status = item.status as AcceptanceStatus
      acc[status] += 1
      return acc
    },
    {
      awaiting_acceptance: 0,
      blocked: 0,
      needs_review: 0,
    }
  )

  return (
    <DashboardSection
      title="Acceptance Queue"
      eyebrow="Operations queue"
      action={
        <span className="tag" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
          {DASHBOARD_ACCEPTANCE_QUEUE.length} open
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
            padding: 14,
            borderColor: '#dbe4f0',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
              Queue summary
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              Приёмка требует ручного контроля по блокерам, доказательствам и клиентским решениям.
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
                key={item.status}
                style={{
                  minWidth: 0,
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${BADGE_STYLE[item.status]}30`,
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 8, fontSize: '1.15rem', fontWeight: 900, color: BADGE_STYLE[item.status] }}>
                  {counts[item.status]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
            Active items
          </div>
        {DASHBOARD_ACCEPTANCE_QUEUE.map((item) => {
          const status = item.status as AcceptanceStatus
          return (
            <div
              key={item.id}
              className="panel"
              style={{
                minWidth: 0,
                padding: 16,
                borderColor: `${BADGE_STYLE[status]}30`,
                background: `linear-gradient(180deg, ${BADGE_STYLE[status]}0d 0%, #ffffff 100%)`,
              }}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      {item.ticket} · {item.title}
                    </div>
                    <div className="muted small">{item.owner}</div>
                  </div>
                  <span
                    className="tag"
                    style={{
                      background: `${BADGE_STYLE[status]}14`,
                      borderColor: `${BADGE_STYLE[status]}33`,
                      color: BADGE_STYLE[status],
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 4,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#fff',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                    Next signal
                  </div>
                  <div className="muted small" style={{ lineHeight: 1.5 }}>
                    {item.hint}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </DashboardSection>
  )
}
