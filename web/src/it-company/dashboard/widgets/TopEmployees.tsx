import { DashboardSection } from '../components/DashboardSection'
import { TOP_EMPLOYEES } from '../mockData'

/** Top employees (digital workers) section. */
export function TopEmployees() {
  return (
    <DashboardSection title="Топ сотрудников">
      <div style={{ display: 'grid', gap: 8 }}>
        {TOP_EMPLOYEES.map((emp) => (
          <div
            key={emp.id}
            className="card"
            style={{
              padding: 10,
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              opacity: emp.comingSoon ? 0.6 : 1,
            }}
          >
            <div className="row" style={{ alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700 }}>{emp.name}</div>
              {emp.comingSoon ? (
                <span className="tag">Скоро</span>
              ) : (
                <span className="muted small">
                  готово {emp.done} · в работе {emp.active}
                </span>
              )}
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>{emp.role}</div>
          </div>
        ))}
      </div>
    </DashboardSection>
  )
}
