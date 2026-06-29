import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffDemoReadinessPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const demo = snapshot.demoReadiness

  return (
    <Panel title={t.photoLabKickoff.sections.demoReadiness}>
      <div className="acKickoffPanelBody">
        <div className="acKickoffDemoHead">
          <span className={`acKickoffOverall acKickoffOverall${capitalize(demo.overall)}`}>
            {t.photoLabKickoff.demoOverall[demo.overall]}
          </span>
          <span className="acKickoffDemoScore">
            {demo.readyCount}/{demo.totalCount} {t.photoLabKickoff.demoReadyLabel}
          </span>
        </div>
        <p className="acKickoffLead">{demo.headline}</p>
        <p className="acMuted">{demo.recommendation}</p>
        <ul className="acKickoffGateList">
          {demo.gates.map((gate) => (
            <li key={gate.id} className={`acKickoffGate acKickoffGate${capitalize(gate.status)}`}>
              <span className="acKickoffGateStatus">{t.photoLabKickoff.gateStatus[gate.status]}</span>
              <span className="acKickoffGateLabel">{gate.label}</span>
              <span className="acKickoffGateNote">{gate.note}</span>
            </li>
          ))}
        </ul>
        <p className="acKickoffDocRef mcMono acMuted">{snapshot.docs.qaChecklist.path}</p>
      </div>
    </Panel>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
