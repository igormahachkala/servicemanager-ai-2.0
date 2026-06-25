import { Link } from 'react-router-dom'
import type { ReportingLine } from '../../domain/organization/reportingLine'
import { OWNER_ID } from '../../domain/organization/organizationStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

type Props = {
  line: ReportingLine
  direction: 'manager' | 'report'
}

export function ManagerCard({ line, direction }: Props) {
  const { t } = useI18n()
  const employeeId = direction === 'manager' ? line.managerId : line.employeeId
  const isOwner = employeeId === OWNER_ID
  const employee = isOwner ? null : resolveEmployee(employeeId)

  const label =
    direction === 'manager' ? t.organizationEngine.manager : t.organizationEngine.directReport
  const displayName = isOwner ? t.organizationEngine.owner : (employee?.codename ?? employeeId)
  const role = direction === 'manager' && !isOwner ? line.role : line.role

  return (
    <div className="mcOrgManagerCard">
      <div className="mcOrgManagerCardHeader">
        <span className="mcOrgManagerCardLabel">{label}</span>
        <span className="mcOrgManagerCardRole mcMuted">{role}</span>
      </div>
      <div className="mcOrgManagerCardBody">
        <span className="mcOrgManagerCardName">{displayName}</span>
        {employee && !isOwner ? (
          <div className="mcOrgManagerCardActions">
            <Link
              to={`/ops/chats/${encodeURIComponent(`conv:${employee.id}`)}`}
              className="mcBtn mcBtnSecondary mcBtnSmall"
            >
              {t.conversations.openConversation}
            </Link>
            {employee.source === 'custom' ? (
              <Link to={`/ops/employees/${employee.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
                {t.employees.openProfile}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ReportingLineItem({ line }: { line: ReportingLine }) {
  const { t } = useI18n()
  const manager =
    line.managerId === OWNER_ID ? t.organizationEngine.owner : resolveEmployee(line.managerId)?.codename
  const employee = resolveEmployee(line.employeeId)?.codename ?? line.employeeId

  return (
    <div className="mcOrgReportingLine">
      <span className="mcOrgReportingLineManager">{manager ?? line.managerId}</span>
      <span className="mcOrgReportingLineArrow" aria-hidden>
        →
      </span>
      <span className="mcOrgReportingLineEmployee mcMono">{employee}</span>
      <span className="mcOrgReportingLineRole mcMuted">{line.role}</span>
    </div>
  )
}
