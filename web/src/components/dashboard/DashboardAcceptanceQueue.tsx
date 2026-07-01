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

export function DashboardAcceptanceQueue() {
  return (
    <DashboardSection title="Acceptance Queue" eyebrow="Placeholder">
      <div style={{ display: 'grid', gap: 10 }}>
        {DASHBOARD_ACCEPTANCE_QUEUE.map((item) => (
          <div key={item.id} className="panel" style={{ background: '#f8fafc', minWidth: 0 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>
                  {item.ticket} · {item.title}
                </div>
                <div className="muted small">{item.owner}</div>
              </div>
              <span
                className="tag"
                style={{
                  background: `${BADGE_STYLE[item.status as AcceptanceStatus]}14`,
                  borderColor: `${BADGE_STYLE[item.status as AcceptanceStatus]}33`,
                  color: BADGE_STYLE[item.status as AcceptanceStatus],
                  whiteSpace: 'nowrap',
                }}
              >
                {STATUS_LABEL[item.status as AcceptanceStatus]}
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              {item.hint}
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
