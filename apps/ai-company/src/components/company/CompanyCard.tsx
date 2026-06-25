import { Link } from 'react-router-dom'
import type { Company } from '../../domain/company/company'
import { useI18n } from '../../i18n'

export function CompanyCard(props: { company: Company; statsLine: string }) {
  const { t } = useI18n()
  const { company, statsLine } = props

  return (
    <article className="mcCompanyCard">
      <div className="mcCompanyCardHead">
        <div>
          <h3 className="mcCompanyCardTitle">{company.name}</h3>
          <div className="mcMono mcMuted">{company.slug}</div>
        </div>
        <span className={`mcCompanyStatus mcCompanyStatus${capitalize(company.status)}`}>
          {t.companyEngine.status[company.status]}
        </span>
      </div>
      <p className="mcCompanyCardDesc">{company.description || t.companyEngine.noDescription}</p>
      <div className="mcCompanyCardMeta mcMuted">
        {t.companyEngine.industry[company.industry]} · {company.country || t.common.empty} ·{' '}
        {statsLine}
      </div>
      <Link to={`/ops/companies/${company.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.companyEngine.openCompany}
      </Link>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
