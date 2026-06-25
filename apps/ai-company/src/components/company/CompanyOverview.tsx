import type { Company } from '../../domain/company/company'
import type { CompanyStats } from '../../domain/company/companyStats'
import { useI18n } from '../../i18n'

export function CompanyOverview(props: { company: Company; stats: CompanyStats }) {
  const { t } = useI18n()
  const { company, stats } = props

  return (
    <div className="mcStack">
      <div className="mcStatGrid">
        <div className="mcStatTile">
          <div className="mcStatValue">{stats.projects}</div>
          <div className="mcStatLabel">{t.companyEngine.stats.projects}</div>
        </div>
        <div className="mcStatTile">
          <div className="mcStatValue">{stats.departments}</div>
          <div className="mcStatLabel">{t.companyEngine.stats.departments}</div>
        </div>
        <div className="mcStatTile">
          <div className="mcStatValue">{stats.workspaces}</div>
          <div className="mcStatLabel">{t.companyEngine.stats.workspaces}</div>
        </div>
        <div className="mcStatTile">
          <div className="mcStatValue">{stats.employees}</div>
          <div className="mcStatLabel">{t.companyEngine.stats.employees}</div>
        </div>
      </div>

      <div className="mcPanel">
        <div className="mcPanelTitle">{t.companyEngine.overview.boundaryTitle}</div>
        <p className="mcMuted">{t.companyEngine.overview.boundaryDesc}</p>
        <ul className="mcBulletList">
          <li>{t.companyEngine.overview.pointProjects}</li>
          <li>{t.companyEngine.overview.pointDepartments}</li>
          <li>{t.companyEngine.overview.pointWorkspaces}</li>
          <li>{t.companyEngine.overview.pointReports}</li>
          <li>{t.companyEngine.overview.pointEmployees}</li>
        </ul>
      </div>

      {company.branding.tagline ? (
        <div className="mcPanel">
          <div className="mcPanelTitle">{t.companyEngine.overview.branding}</div>
          <p>{company.branding.tagline}</p>
        </div>
      ) : null}
    </div>
  )
}
