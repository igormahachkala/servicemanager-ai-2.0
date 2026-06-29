import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffCtoPlanPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const plan = snapshot.ctoPlan

  return (
    <Panel title={t.photoLabKickoff.sections.ctoPlan}>
      <div className="acKickoffPanelBody">
        <p className="acMuted">{snapshot.docs.ctoPlan.summary}</p>
        <h3 className="acKickoffSubhead">{t.photoLabKickoff.cto.weekGoal}</h3>
        <p>{plan.weekGoal}</p>
        <h3 className="acKickoffSubhead">{t.photoLabKickoff.cto.priorities}</h3>
        <ul className="acKickoffBulletList">
          {plan.priorities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3 className="acKickoffSubhead">{t.photoLabKickoff.cto.codexScope}</h3>
        <ul className="acKickoffBulletList">
          {plan.codexScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="acKickoffDocRef mcMono acMuted">{snapshot.docs.ctoPlan.path}</p>
      </div>
    </Panel>
  )
}
