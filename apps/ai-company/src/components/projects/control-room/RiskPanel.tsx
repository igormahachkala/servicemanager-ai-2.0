import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function RiskPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabControlRoom.sections.risks}>
      <div className="mcProfilePanelBody">
        {snapshot.risks.length === 0 ? (
          <div className="mcControlRoomEmpty">{t.photoLabControlRoom.empty.risks}</div>
        ) : (
          <ul className="mcControlRoomRiskList">
            {snapshot.risks.map((risk) => (
              <li key={risk.id} className="mcControlRoomRiskCard">
                <div className="mcControlRoomRiskHead">
                  <span className="mcControlRoomRiskTitle">{risk.title}</span>
                  <span className={`mcControlRoomBadge mcControlRoomRisk${risk.severity}`}>
                    {risk.severity}
                  </span>
                  <span className="mcControlRoomBadge">{risk.status}</span>
                </div>
                <p className="mcMuted">{risk.description}</p>
                {risk.mitigation ? (
                  <p className="mcControlRoomMitigation">{risk.mitigation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
