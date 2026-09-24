import {
  AcceptanceQueueCard,
  ActionCenter,
  DashboardGrid,
  KpiCard,
  RecentEvents,
  TeamLoadCard,
} from '../components/dashboard'
import { DASHBOARD_KPIS } from '../components/dashboard/mockData'

export function DashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
      <header
        className="panel"
        style={{
          display: 'grid',
          gap: 18,
          minWidth: 0,
          overflow: 'hidden',
          borderColor: '#dbe4f0',
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 52%, rgba(14,116,144,0.88) 100%)',
          color: '#f8fafc',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(191, 219, 254, 0.28)',
                background: 'rgba(15, 23, 42, 0.22)',
                color: '#bfdbfe',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Management Console V2
            </div>
            <h1 style={{ margin: '12px 0 0', fontSize: 'clamp(2rem, 3.5vw, 3rem)', lineHeight: 1.02, letterSpacing: '-0.04em' }}>
              Operations Center
            </h1>
            <div style={{ marginTop: 10, color: 'rgba(226, 232, 240, 0.92)', maxWidth: 760, lineHeight: 1.6 }}>
              Сводка по рабочему дню: входящий поток, очередь приёмки, нагрузка команды и последние операционные события в одном контуре.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              minWidth: 0,
              padding: 16,
              borderRadius: 18,
              border: '1px solid rgba(148, 163, 184, 0.26)',
              background: 'rgba(15, 23, 42, 0.26)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Focus for today
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
              Привести к решению срочные заявки, снять блокеры по приёмке и выровнять загрузку исполнителей.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span
                className="tag"
                style={{ background: 'rgba(251, 191, 36, 0.16)', borderColor: 'rgba(251, 191, 36, 0.32)', color: '#fde68a' }}
              >
                Acceptance queue
              </span>
              <span
                className="tag"
                style={{ background: 'rgba(96, 165, 250, 0.14)', borderColor: 'rgba(96, 165, 250, 0.3)', color: '#bfdbfe' }}
              >
                Team load
              </span>
              <span
                className="tag"
                style={{ background: 'rgba(74, 222, 128, 0.14)', borderColor: 'rgba(74, 222, 128, 0.3)', color: '#bbf7d0' }}
              >
                Recent events
              </span>
            </div>
          </div>
        </div>
      </header>

      <DashboardGrid>
        {DASHBOARD_KPIS.map((item) => (
          <KpiCard key={item.id} label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
        ))}
      </DashboardGrid>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <ActionCenter />
          <RecentEvents />
        </div>

        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <TeamLoadCard />
          <AcceptanceQueueCard />
        </div>
      </div>
    </div>
  )
}
