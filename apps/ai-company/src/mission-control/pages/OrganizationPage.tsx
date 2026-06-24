import { PageHeader, Panel, capFillClass } from '../components/ui'
import { agentsBySquad, domains, squads } from '../data/mock'

export function OrganizationPage() {
  return (
    <>
      <PageHeader
        title="Organization"
        description="Operational squads, domains, and capacity — not an HR org chart."
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
    </>
  )
}
