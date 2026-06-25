import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { TeamCard } from '../components/organization/TeamCard'
import { useOrganization } from '../hooks/useOrganization'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useI18n } from '../i18n'

export function DepartmentPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getDepartmentById, getTeamsByDepartment } = useOrganization()

  const department = id ? getDepartmentById(id) : null
  const teams = department ? getTeamsByDepartment(department.id) : []
  const head = department?.headEmployeeId ? resolveEmployee(department.headEmployeeId) : null

  if (!department) {
    return (
      <>
        <PageHeader
          title={t.organizationEngine.departmentNotFound}
          description={t.organizationEngine.departmentNotFoundDesc}
        />
        <div className="mcOrgEmpty">
          <Link to="/ops/organization" className="mcBtn mcBtnPrimary">
            {t.organizationEngine.backToOrganization}
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mcOrgPageTop">
        <Link to="/ops/organization" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.organizationEngine.backToOrganization}
        </Link>
      </div>
      <PageHeader title={department.name} description={department.description} />

      <div className="mcOrgDetailGrid">
        <Panel title={t.organizationEngine.departmentOverview}>
          <div className="mcProfilePanelBody">
            <div className="mcProfileFieldGrid">
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.departmentHead}</div>
                <div className="mcProfileFieldValue mcMono">{head?.codename ?? t.common.empty}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.stats.teams}</div>
                <div className="mcProfileFieldValue">{teams.length}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.stats.headcount}</div>
                <div className="mcProfileFieldValue">
                  {teams.reduce((sum, team) => sum + team.members.length, 0)}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.organizationEngine.teamsInDepartment}>
          <div className="mcOrgCardGrid">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} department={department} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}
