import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffQaChecklistPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabKickoff.sections.qaChecklist}>
      <div className="acKickoffPanelBody" id="kickoff-qa-checklist">
        <p className="acMuted">{snapshot.docs.qaChecklist.summary}</p>
        <ul className="acKickoffChecklist">
          {snapshot.controlRoom.demoChecklist.map((item) => (
            <li key={item.key} className={`acKickoffCheckItem acKickoffCheck${item.status}`}>
              <span>{t.photoLabControlRoom.demoItems[item.key]}</span>
              <span className="acKickoffBadge">{item.status}</span>
            </li>
          ))}
        </ul>
        <div className="acKickoffInlineActions">
          <Link to={snapshot.links.demoChecklistAnchor} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openDemoChecklist}
          </Link>
          <Link to={snapshot.links.execution} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.pages.execution}
          </Link>
        </div>
        <p className="acKickoffDocRef mcMono acMuted">{snapshot.docs.qaChecklist.path}</p>
      </div>
    </Panel>
  )
}
