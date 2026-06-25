import type { CompanyStats } from '../../domain/company/companyStats'
import { useI18n } from '../../i18n'

export function CompanyStatistics(props: { stats: CompanyStats }) {
  const { t } = useI18n()
  const { stats } = props

  const rows = [
    { label: t.companyEngine.stats.projects, value: stats.projects, sub: stats.activeProjects },
    { label: t.companyEngine.stats.departments, value: stats.departments },
    { label: t.companyEngine.stats.workspaces, value: stats.workspaces },
    { label: t.companyEngine.stats.employees, value: stats.employees, sub: stats.activeAssignments },
    { label: t.companyEngine.stats.reports, value: stats.reports },
    { label: t.companyEngine.stats.auditEvents, value: stats.auditEvents },
  ]

  return (
    <div className="mcStack">
      <table className="mcTable">
        <thead>
          <tr>
            <th>{t.labels.name}</th>
            <th>{t.companyEngine.stats.count}</th>
            <th>{t.companyEngine.stats.activeSub}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="mcMono">{row.value}</td>
              <td className="mcMuted">{row.sub ?? t.common.empty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
