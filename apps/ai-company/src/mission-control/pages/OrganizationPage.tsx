import { PageHeader, Panel, capFillClass } from '../components/ui'
import { agentsBySquad, domains, squads } from '../data/mock'
import { optionLabel } from '../data/customEmployees'
import { useCustomEmployees } from '../hooks/useCustomEmployees'
import { useI18n } from '../../i18n'

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="mcMuted">{emptyLabel}</span>
  }

  return (
    <div className="mcTagRow">
      {items.map((item) => (
        <span key={item} className="mcTag">
          {item}
        </span>
      ))}
    </div>
  )
}

export function OrganizationPage() {
  const { t } = useI18n()
  const { employees: customEmployees } = useCustomEmployees()

  return (
    <>
      <PageHeader
        title={t.pages.organization}
        description={t.organization.description}
      />

      <div className="mcDomainGrid">
        {domains.map((domain) => {
          const count = squads.filter((s) => s.domain === domain).length
          const agents = squads
            .filter((s) => s.domain === domain)
            .reduce((n, s) => n + s.headcount, 0)
          return (
            <div key={domain} className="mcDomainCard">
              <div className="mcDomainName">{domain}</div>
              <div className="mcDomainCount">
                {count} squads · {agents} agents
              </div>
            </div>
          )
        })}
      </div>

      <Panel title="Squads">
        <table className="mcTable">
          <thead>
            <tr>
              <th>Squad</th>
              <th>Domain</th>
              <th>Lead agent</th>
              <th>Headcount</th>
              <th>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {squads.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="mcMuted">{s.domain}</td>
                <td className="mcMono">{s.leadAgent}</td>
                <td className="mcMono">{s.headcount}</td>
                <td style={{ minWidth: 140 }}>
                  <span className="mcMono">{s.capacityPct}%</span>
                  <div className="mcCapBar">
                    <div className={capFillClass(s.capacityPct)} style={{ width: `${s.capacityPct}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Squad roster snapshot">
          <table className="mcTable">
            <thead>
              <tr>
                <th>Squad</th>
                <th>Agent</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {squads.flatMap((s) =>
                agentsBySquad(s.name).map((a) => (
                  <tr key={a.id}>
                    <td className="mcMuted">{s.name}</td>
                    <td className="mcMono">{a.codename}</td>
                    <td>{a.role}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      {customEmployees.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Panel
            title={t.organization.customEmployees}
            right={
              <span className="mcMono mcMuted">
                {customEmployees.length} {t.employees.agents}
              </span>
            }
          >
            <table className="mcTable">
              <thead>
                <tr>
                  <th>{t.employeeBuilder.fields.codename}</th>
                  <th>{t.labels.role}</th>
                  <th>{t.labels.status}</th>
                  <th>{t.employeeBuilder.fields.skills}</th>
                  <th>{t.employeeBuilder.fields.memoryScope}</th>
                </tr>
              </thead>
              <tbody>
                {customEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="mcMono" style={{ fontWeight: 600 }}>
                      {employee.codename}
                    </td>
                    <td>{employee.role}</td>
                    <td className="mcMono">{t.employeeBuilder.status[employee.status]}</td>
                    <td>
                      <TagList
                        items={employee.skills.map((skill) =>
                          optionLabel(t.employeeBuilder.options.skills, skill),
                        )}
                        emptyLabel="—"
                      />
                    </td>
                    <td>
                      <TagList
                        items={employee.memoryScope.map((scope) =>
                          optionLabel(t.employeeBuilder.options.memoryScope, scope),
                        )}
                        emptyLabel="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}
    </>
  )
}
