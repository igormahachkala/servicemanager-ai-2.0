import { Link } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { CompanyCard } from '../components/company/CompanyCard'
import { CompanyEmptyState } from '../components/company/CompanyEmptyState'
import { computeCompanyStats } from '../domain/company/companyStats'
import { useCompanies } from '../hooks/useCompanies'
import { useI18n } from '../i18n'

export function CompaniesPage() {
  const { t } = useI18n()
  const { companies } = useCompanies()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.companies} description={t.companyEngine.listDescription} />
        <Link to="/ops/companies/new" className="mcBtn mcBtnPrimary">
          {t.companyEngine.newCompany}
        </Link>
      </div>

      {companies.length === 0 ? (
        <CompanyEmptyState
          title={t.companyEngine.emptyListTitle}
          description={t.companyEngine.emptyListDescription}
          action={
            <Link to="/ops/companies/new" className="mcBtn mcBtnPrimary">
              {t.companyEngine.newCompany}
            </Link>
          }
        />
      ) : (
        <div className="mcCompanyGrid">
          {companies.map((company) => {
            const stats = computeCompanyStats(company.id)
            const statsLine = `${stats.projects} ${t.companyEngine.stats.projectsShort} · ${stats.employees} ${t.companyEngine.stats.employeesShort}`
            return <CompanyCard key={company.id} company={company} statsLine={statsLine} />
          })}
        </div>
      )}
    </>
  )
}
