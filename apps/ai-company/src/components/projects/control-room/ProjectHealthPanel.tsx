import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function ProjectHealthPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabControlRoom.sections.mvpStatus}>
      <div className="mcProfilePanelBody mcControlRoomHealth">
        <div className="mcControlRoomGoal">{snapshot.goal}</div>
        <div className="mcControlRoomMetrics">
          <div className="mcControlRoomMetric">
            <span className="mcControlRoomMetricLabel">{t.photoLabControlRoom.deadline}</span>
            <span className="mcControlRoomMetricValue">
              {snapshot.deadline
                ? new Date(snapshot.deadline).toLocaleDateString()
                : t.common.empty}
            </span>
          </div>
          <div className="mcControlRoomMetric">
            <span className="mcControlRoomMetricLabel">{t.photoLabControlRoom.progress}</span>
            <span className="mcControlRoomMetricValue">{snapshot.progress}%</span>
          </div>
          <div className="mcControlRoomMetric">
            <span className="mcControlRoomMetricLabel">{t.photoLabControlRoom.health}</span>
            <span className={`mcControlRoomBadge mcControlRoomHealth${snapshot.health}`}>
              {t.photoLabControlRoom.healthLevels[snapshot.health]}
            </span>
          </div>
          <div className="mcControlRoomMetric">
            <span className="mcControlRoomMetricLabel">{t.photoLabControlRoom.riskLevel}</span>
            <span className={`mcControlRoomBadge mcControlRoomRisk${snapshot.riskLevel}`}>
              {t.photoLabControlRoom.riskLevels[snapshot.riskLevel]}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  )
}
