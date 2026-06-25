import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { CompanyHeader } from '../components/company/CompanyHeader'
import { CompanyOverview } from '../components/company/CompanyOverview'
import { CompanyProjects } from '../components/company/CompanyProjects'
import { CompanyDepartments } from '../components/company/CompanyDepartments'
import { CompanyEmployees } from '../components/company/CompanyEmployees'
import { CompanyStatistics } from '../components/company/CompanyStatistics'
import { CompanySettings } from '../components/company/CompanySettings'
import { CompanyFuturePlaceholders } from '../components/company/CompanyFuturePlaceholders'
import { CompanyEmptyState } from '../components/company/CompanyEmptyState'
import { getCompanyAssignmentsByCompany } from '../domain/company/companyAssignmentStorage'
import { getProjectsByCompanyId } from '../domain/projects/project'
import { computeCompanyStats } from '../domain/company/companyStats'
import { loadOrganization } from '../domain/organization/organizationStorage'
import { useCompanies } from '../hooks/useCompanies'
import { setActiveCompanyId } from '../hooks/useActiveCompany'
import { useI18n } from '../i18n'

type CompanySection =
  | 'overview'
  | 'projects'
  | 'departments'
  | 'employees'
  | 'statistics'
  | 'settings'
  | 'future'

export function CompanyPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { companies } = useCompanies()
  const [section, setSection] = useState<CompanySection>('overview')

  const company = useMemo(
    () => companies.find((item) => item.id === id) ?? null,
    [companies, id],
  )

  useEffect(() => {
    if (company) setActiveCompanyId(company.id)
  }, [company])

  const stats = useMemo(
    () => (company ? computeCompanyStats(company.id) : null),
    [company],
  )

  const projects = useMemo(
    () => (company ? getProjectsByCompanyId(company.id) : []),
    [company],
  )

  const departments = useMemo(() => {
    if (!company) return []
    return loadOrganization().departments.filter((item) => item.companyId === company.id)
  }, [company])

  const assignments = useMemo(
    () => (company ? getCompanyAssignmentsByCompany(company.id) : []),
    [company],
  )

  const sections: CompanySection[] = [
    'overview',
    'projects',
    'departments',
    'employees',
    'statistics',
    'settings',
    'future',
  ]

  if (!company || !stats) {
    return (
      <>
        <PageHeader title={t.companyEngine.notFoundTitle} description={t.companyEngine.notFoundDescription} />
        <CompanyEmptyState
          title={t.companyEngine.notFoundTitle}
          description={t.companyEngine.notFoundDescription}
          action={
            <Link to="/ops/companies" className="mcBtn mcBtnPrimary">
              {t.companyEngine.backToList}
            </Link>
          }
        />
      </>
    )
  }

  return (
    <div className="mcCompanyPage">
      <CompanyHeader company={company} />

      <nav className="mcProfileNav" aria-label={t.companyEngine.navLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.companyEngine.tabs[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? <CompanyOverview company={company} stats={stats} /> : null}
        {section === 'projects' ? (
          <Panel title={t.companyEngine.tabs.projects}>
            <CompanyProjects projects={projects} />
          </Panel>
        ) : null}
        {section === 'departments' ? (
          <Panel title={t.companyEngine.tabs.departments}>
            <CompanyDepartments departments={departments} />
          </Panel>
        ) : null}
        {section === 'employees' ? (
          <Panel title={t.companyEngine.tabs.employees}>
            <CompanyEmployees assignments={assignments} />
          </Panel>
        ) : null}
        {section === 'statistics' ? (
          <Panel title={t.companyEngine.tabs.statistics}>
            <CompanyStatistics stats={stats} />
          </Panel>
        ) : null}
        {section === 'settings' ? (
          <Panel title={t.companyEngine.tabs.settings}>
            <CompanySettings key={company.updatedAt} company={company} />
          </Panel>
        ) : null}
        {section === 'future' ? (
          <Panel title={t.companyEngine.tabs.future}>
            <CompanyFuturePlaceholders />
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
