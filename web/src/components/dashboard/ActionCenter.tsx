import { Link } from 'react-router-dom'
import { DashboardSection } from './DashboardSection'
import { DASHBOARD_ACTIONS } from './mockData'

export function ActionCenter() {
  const [primaryAction, ...secondaryActions] = DASHBOARD_ACTIONS
  const summaryItems = [
    {
      id: 'summary-queue',
      label: 'Urgent attention',
      value: '3 items',
      hint: 'Очередь приёмки и runtime-предупреждения требуют ручного решения.',
      tone: '#f59e0b',
    },
    {
      id: 'summary-runtime',
      label: 'Runtime health',
      value: 'Stable',
      hint: 'Последний контур завершился без hard-failure, но есть 1 warning.',
      tone: '#2563eb',
    },
    {
      id: 'summary-team',
      label: 'Team focus',
      value: '7 active',
      hint: 'Основная нагрузка смещена в delivery и acceptance follow-up.',
      tone: '#16a34a',
    },
  ]

  return (
    <DashboardSection
      title="Action Center"
      eyebrow="Control center"
      action={<span className="tag" style={{ background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' }}>Live workflow</span>}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 14,
            alignItems: 'stretch',
          }}
        >
          <div
            className="panel"
            style={{
              minWidth: 0,
              display: 'grid',
              gap: 14,
              padding: 18,
              borderColor: '#fcd34d',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)',
              boxShadow: '0 18px 36px rgba(180, 83, 9, 0.10)',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                className="tag"
                style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#b45309', fontWeight: 800 }}
              >
                Urgent attention
              </span>
              <span className="muted small" style={{ fontWeight: 700 }}>
                First response lane
              </span>
            </div>
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <div style={{ fontSize: '1.35rem', lineHeight: 1.15, fontWeight: 900, color: '#7c2d12' }}>
                {primaryAction.title}
              </div>
              <div className="muted" style={{ maxWidth: 640, lineHeight: 1.55, color: '#7c2d12' }}>
                {primaryAction.description}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              {summaryItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    minWidth: 0,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${item.tone}2e`,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '1.15rem', fontWeight: 900, color: item.tone }}>
                    {item.value}
                  </div>
                  <div className="muted small" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    {item.hint}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Link to={primaryAction.to} className="mcBtn mcBtnSecondary">
                {primaryAction.cta}
              </Link>
            </div>
          </div>

          <div
            className="panel"
            style={{
              minWidth: 0,
              display: 'grid',
              gap: 12,
              padding: 18,
              borderColor: '#dbe4f0',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
                Ops summary
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Основные решения на текущий цикл
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Acceptance queue pressure</div>
                <div className="muted small">2 элемента ждут клиентское решение, 1 заблокирован отсутствием комментария.</div>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Runtime and delivery</div>
                <div className="muted small">Контур живой, но нужен приоритет на проверку предупреждений и доказательств выполнения.</div>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Recommended next move</div>
                <div className="muted small">Открыть Control Room или Runtime, затем сверить очередь приёмки с последними событиями.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
            Quick actions
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {secondaryActions.map((action, index) => (
              <div
                key={action.id}
                className="panel"
                style={{
                  minWidth: 0,
                  display: 'grid',
                  gap: 10,
                  padding: 16,
                  background: index % 2 === 0 ? '#f8fafc' : '#fff',
                  borderColor: '#dbe4f0',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{action.title}</div>
                  <span className="tag" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                    Open
                  </span>
                </div>
                <div className="muted small" style={{ minHeight: 40, lineHeight: 1.5 }}>
                  {action.description}
                </div>
                <div>
                  <Link to={action.to} className="mcBtn mcBtnSecondary mcBtnSmall">
                    {action.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardSection>
  )
}
