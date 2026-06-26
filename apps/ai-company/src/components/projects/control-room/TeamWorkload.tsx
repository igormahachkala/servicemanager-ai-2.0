import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function TeamWorkload({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabControlRoom.sections.digitalTeam}>
      <div className="mcProfilePanelBody">
        <ul className="mcControlRoomTeamList">
          {snapshot.team.map((member) => (
            <li key={member.id} className="mcControlRoomTeamRow">
              <div className="mcControlRoomTeamHead">
                {member.kind === 'employee' ? (
                  <Link to={`/ops/employees/${encodeURIComponent(member.id)}`} className="mcControlRoomTeamName">
                    {member.codename}
                  </Link>
                ) : (
                  <span className="mcControlRoomTeamName">{member.codename}</span>
                )}
                <span className="mcMuted">{member.role}</span>
                {member.presence ? (
                  <span className={`mcControlRoomPresence mcControlRoomPresence${member.presence.status}`}>
                    {member.presence.status}
                  </span>
                ) : null}
              </div>
              {member.currentTask ? (
                <div className="mcControlRoomTeamTask">
                  <span className="mcMono">{member.currentTask.title}</span>
                  {member.executionStatus ? (
                    <span className="mcControlRoomBadge">{member.executionStatus}</span>
                  ) : null}
                </div>
              ) : (
                <div className="mcMuted">{t.photoLabControlRoom.noCurrentTask}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
