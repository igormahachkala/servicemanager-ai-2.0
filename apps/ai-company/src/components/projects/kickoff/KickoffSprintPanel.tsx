import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffSprintPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const sprint = snapshot.sprint

  return (
    <Panel title={t.photoLabKickoff.sections.sprintGoal}>
      <div className="acKickoffPanelBody">
        <p className="acKickoffLead">{sprint?.sprint.goal ?? snapshot.controlRoom.goal}</p>
        {sprint ? (
          <div className="acKickoffMetaGrid">
            <div>
              <span className="acKickoffMetaLabel">{t.photoLabKickoff.sprint.name}</span>
              <strong>{sprint.sprint.name}</strong>
            </div>
            <div>
              <span className="acKickoffMetaLabel">{t.photoLabKickoff.sprint.status}</span>
              <strong>{t.sprintEngine.status[sprint.sprint.status]}</strong>
            </div>
            <div>
              <span className="acKickoffMetaLabel">{t.photoLabKickoff.sprint.tasks}</span>
              <strong>{sprint.stats.remaining + sprint.stats.completed}</strong>
            </div>
            <div>
              <span className="acKickoffMetaLabel">{t.photoLabKickoff.sprint.health}</span>
              <strong>{t.sprintEngine.health[sprint.stats.health]}</strong>
            </div>
          </div>
        ) : null}
        <Link to={snapshot.links.sprint} className="mcLink">
          {t.photoLabKickoff.actions.openSprint}
        </Link>
      </div>
    </Panel>
  )
}
