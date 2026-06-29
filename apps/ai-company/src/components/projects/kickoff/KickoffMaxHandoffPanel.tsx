import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'
import { handoffStatusLabel } from '../../../i18n/uiLabels'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffMaxHandoffPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const handoff = snapshot.maxHandoff

  return (
    <Panel title={t.photoLabKickoff.sections.maxHandoff}>
      <div className="acKickoffPanelBody">
        <div className="acKickoffHandoffHead">
          <strong>{handoff.title}</strong>
          <span className="acKickoffBadge">{handoffStatusLabel(t, handoff.status)}</span>
        </div>
        <p className="acMuted">
          {handoff.from} → {handoff.to} · {handoff.linkedTaskId}
        </p>
        <p>{snapshot.docs.maxHandoff.summary}</p>
        <ul className="acKickoffBulletList">
          {handoff.findings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="acMuted mcMono">{handoff.targetRepo}</p>
        {handoff.handoff?.checklist ? (
          <p className="acMuted">
            {handoff.handoff.checklist.filter((item) => item.done).length}/
            {handoff.handoff.checklist.length} {t.photoLabKickoff.handoffChecklistDone}
          </p>
        ) : null}
        <Link to={snapshot.links.handoff} className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.photoLabKickoff.actions.openCodexHandoff}
        </Link>
        <p className="acKickoffDocRef mcMono acMuted">{snapshot.docs.maxHandoff.path}</p>
      </div>
    </Panel>
  )
}
