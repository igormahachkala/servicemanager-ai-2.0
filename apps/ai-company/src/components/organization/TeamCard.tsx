import { Link } from 'react-router-dom'
import type { Team } from '../../domain/organization/team'
import type { Department } from '../../domain/organization/department'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

type Props = {
  team: Team
  department: Department | null
}

export function TeamCard({ team, department }: Props) {
  const { t } = useI18n()
  const lead = team.leadEmployeeId ? resolveEmployee(team.leadEmployeeId) : null

  return (
    <Link to={`/ops/organization/teams/${team.id}`} className="mcOrgCard mcOrgCardLink">
      <div className="mcOrgCardHeader">
        <h3 className="mcOrgCardTitle">{team.name}</h3>
        <span className="mcOrgCardBadge">
          {team.members.length} {t.organizationEngine.membersUnit}
        </span>
      </div>
      {department ? (
        <div className="mcOrgCardMeta">
          <span className="mcOrgCardMetaLabel">{t.organizationEngine.department}</span>
          <span>{department.name}</span>
        </div>
      ) : null}
      <p className="mcOrgCardDesc mcMuted">{team.description}</p>
      <div className="mcOrgCardMeta">
        <span className="mcOrgCardMetaLabel">{t.organizationEngine.teamLead}</span>
        <span className="mcMono">{lead?.codename ?? t.common.empty}</span>
      </div>
    </Link>
  )
}
