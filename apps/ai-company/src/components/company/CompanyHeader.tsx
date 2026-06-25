import type { Company } from '../../domain/company/company'
import { useI18n } from '../../i18n'

export function CompanyHeader(props: { company: Company }) {
  const { t } = useI18n()
  const { company } = props

  return (
    <header className="mcCompanyHeader">
      <div className="mcCompanyHeaderTop">
        <div className="mcCompanyHeaderBadges">
          <span className="mcCompanyIndustryBadge">{t.companyEngine.industry[company.industry]}</span>
          <span className={`mcCompanyStatus mcCompanyStatus${capitalize(company.status)}`}>
            {t.companyEngine.status[company.status]}
          </span>
        </div>
        <span className="mcMono mcMuted">{company.slug}</span>
      </div>
      <h1 className="mcCompanyTitle">{company.name}</h1>
      <p className="mcCompanyDesc">{company.description || t.companyEngine.noDescription}</p>
      <div className="mcCompanyMeta mcMuted">
        {t.companyEngine.owner}: {company.owner || t.common.empty} · {company.country || t.common.empty} ·{' '}
        {company.timezone}
      </div>
    </header>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
