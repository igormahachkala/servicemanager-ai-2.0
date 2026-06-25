import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useOrganization } from '../hooks/useOrganization'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useI18n } from '../i18n'

export function TeamPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getTeamById, getDepartmentById } = useOrganization()

  const team = id ? getTeamById(id) : null
  const department = team ? getDepartmentById(team.departmentId) : null
  const lead = team?.leadEmployeeId ? resolveEmployee(team.leadEmployeeId) : null

  if (!team) {
    return (
      <>
        <PageHeader
          title={t.organizationEngine.teamNotFound}
          description={t.organizationEngine.teamNotFoundDesc}
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
      <PageHeader title={team.name} description={team.description} />

      <div className="mcOrgDetailGrid">
        <Panel title={t.organizationEngine.teamOverview}>
          <div className="mcProfilePanelBody">
            <div className="mcProfileFieldGrid">
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.department}</div>
                <div className="mcProfileFieldValue">
                  {department ? (
                    <Link to={`/ops/organization/departments/${department.id}`}>{department.name}</Link>
                  ) : (
                    t.common.empty
                  )}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.teamLead}</div>
                <div className="mcProfileFieldValue mcMono">{lead?.codename ?? t.common.empty}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.organizationEngine.stats.headcount}</div>
                <div className="mcProfileFieldValue">{team.members.length}</div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.organizationEngine.teamMembers}>
          {team.members.length === 0 ? (
            <div className="mcOrgEmptyInline mcMuted">{t.organizationEngine.noMembers}</div>
          ) : (
            <table className="mcTable">
              <thead>
                <tr>
                  <th>{t.labels.agent}</th>
                  <th>{t.labels.role}</th>
                  <th>{t.employees.actions}</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((memberId) => {
                  const employee = resolveEmployee(memberId)
                  return (
                    <tr key={memberId}>
                      <td className="mcMono" style={{ fontWeight: 600 }}>
                        {employee?.codename ?? memberId}
                      </td>
                      <td>{employee?.role ?? t.common.empty}</td>
                      <td>
                        <div className="mcRowFlex">
                          {employee ? (
                            <>
                              <Link
                                to={`/ops/chats/${encodeURIComponent(`conv:${employee.id}`)}`}
                                className="mcBtn mcBtnSecondary mcBtnSmall"
                              >
                                {t.conversations.openConversation}
                              </Link>
                              {employee.source === 'custom' ? (
                                <Link
                                  to={`/ops/employees/${employee.id}`}
                                  className="mcBtn mcBtnSecondary mcBtnSmall"
                                >
                                  {t.employees.openProfile}
                                </Link>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  )
}
