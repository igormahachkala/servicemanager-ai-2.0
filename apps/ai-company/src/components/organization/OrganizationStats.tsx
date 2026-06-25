import type { OrganizationStats } from '../../domain/organization/organizationStorage'
import { useI18n } from '../../i18n'

export function OrganizationStats({ stats }: { stats: OrganizationStats }) {
  const { t } = useI18n()

  const items = [
    { label: t.organizationEngine.stats.departments, value: stats.departments },
    { label: t.organizationEngine.stats.teams, value: stats.teams },
    { label: t.organizationEngine.stats.headcount, value: stats.headcount },
    { label: t.organizationEngine.stats.activeEmployees, value: stats.activeEmployees },
    { label: t.organizationEngine.stats.customEmployees, value: stats.customEmployees },
    { label: t.organizationEngine.stats.plannedEmployees, value: stats.plannedEmployees },
  ]

  return (
    <div className="mcOrgStatsGrid">
      {items.map((item) => (
        <div key={item.label} className="mcOrgStatCard">
          <div className="mcOrgStatValue">{item.value}</div>
          <div className="mcOrgStatLabel mcMuted">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
