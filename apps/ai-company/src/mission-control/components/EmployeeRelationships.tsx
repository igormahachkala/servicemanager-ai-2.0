import { Link } from 'react-router-dom'
import { Panel } from './ui'
import { ManagerCard } from '../../components/organization/ReportingLine'
import { useOrganization } from '../../hooks/useOrganization'
import { OWNER_ID } from '../../domain/organization/organizationStorage'
import { resolveEmployee } from '../data/conversation'
import { useI18n } from '../../i18n'

export function EmployeeRelationships({ employeeId }: { employeeId: string }) {
  const { t } = useI18n()
  const { getEmployeeContext } = useOrganization()
  const context = getEmployeeContext(employeeId)
  const employee = resolveEmployee(employeeId)

  if (!employee) return null

  const hasOrgData =
    context.manager !== null ||
    context.directReports.length > 0 ||
    context.department !== null ||
    context.team !== null

  return (
    <div className="mcProfileGrid">
      <Panel title={t.organizationEngine.orgPlacement}>
        <div className="mcProfilePanelBody">
          <div className="mcProfileFieldGrid">
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.organizationEngine.department}</div>
              <div className="mcProfileFieldValue">
                {context.department ? (
                  <Link to={`/ops/organization/departments/${context.department.id}`}>
                    {context.department.name}
                  </Link>
                ) : (
                  t.organizationEngine.unassigned
                )}
              </div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.organizationEngine.team}</div>
              <div className="mcProfileFieldValue">
                {context.team ? (
                  <Link to={`/ops/organization/teams/${context.team.id}`}>{context.team.name}</Link>
                ) : (
                  t.organizationEngine.unassigned
                )}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t.organizationEngine.reportingLines}>
        <div className="mcProfilePanelBody mcOrgRelationshipsBody">
          {context.manager ? (
            <ManagerCard line={context.manager} direction="manager" />
          ) : (
            <div className="mcOrgEmptyInline mcMuted">{t.organizationEngine.noManager}</div>
          )}

          <div className="mcOrgDirectReports">
            <div className="mcOrgSectionLabel">{t.organizationEngine.directReports}</div>
            {context.directReports.length === 0 ? (
              <div className="mcOrgEmptyInline mcMuted">{t.organizationEngine.noDirectReports}</div>
            ) : (
              <div className="mcOrgDirectReportsList">
                {context.directReports.map((line) => (
                  <ManagerCard key={line.id} line={line} direction="report" />
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {!hasOrgData ? (
        <Panel title={t.employeeProfile.sections.relationships}>
          <div className="mcProfilePanelBody">
            <p className="mcMuted">{t.organizationEngine.noOrgDataHint}</p>
            <Link to="/ops/organization" className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.organizationEngine.openOrganization}
            </Link>
          </div>
        </Panel>
      ) : null}

      {employeeId !== OWNER_ID ? (
        <p className="mcOrgFootnote mcMuted">{t.organizationEngine.orgVsWorkspaceHint}</p>
      ) : null}
    </div>
  )
}
