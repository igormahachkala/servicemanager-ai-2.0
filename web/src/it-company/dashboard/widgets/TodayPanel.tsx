import { DashboardSection } from '../components/DashboardSection'
import { TODAY_ITEMS } from '../mockData'

/** "Today" snapshot section. */
export function TodayPanel() {
  return (
    <DashboardSection title="Сегодня">
      <div style={{ display: 'grid', gap: 8 }}>
        {TODAY_ITEMS.map((item) => (
          <div key={item.id} className="row" style={{ alignItems: 'baseline' }}>
            <span className="muted small">{item.label}</span>
            <span style={{ fontWeight: 700 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
