import { Link } from 'react-router-dom'
import type { Department } from '../../domain/organization/department'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

type Props = {
  department: Department
  teamCount: number
  memberCount: number
}

export function DepartmentCard({ department, teamCount, memberCount }: Props) {
  const { t } = useI18n()
  const head = department.headEmployeeId ? resolveEmployee(department.headEmployeeId) : null

  return (
    <Link to={`/ops/organization/departments/${department.id}`} className="mcOrgCard mcOrgCardLink">
      <div className="mcOrgCardHeader">
        <h3 className="mcOrgCardTitle">{department.name}</h3>
        <span className="mcOrgCardBadge">
          {teamCount} {t.organizationEngine.teamsUnit} · {memberCount} {t.organizationEngine.membersUnit}
        </span>
      </div>
      <p className="mcOrgCardDesc mcMuted">{department.description}</p>
      <div className="mcOrgCardMeta">
        <span className="mcOrgCardMetaLabel">{t.organizationEngine.departmentHead}</span>
        <span className="mcMono">{head?.codename ?? t.common.empty}</span>
      </div>
    </Link>
  )
}
