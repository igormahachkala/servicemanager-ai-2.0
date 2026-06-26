import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../domain/projects/aiPhotoLabControlRoom'
import { AI_PHOTO_LAB_CONTROL_ROOM_PATH } from '../../domain/projects/aiPhotoLabControlRoom'
import { Card } from '../layout'
import { useI18n } from '../../i18n'

type Props = {
  controlRoom: AiPhotoLabControlRoomSnapshot | null
}

export function ControlRoomPreviewPanel({ controlRoom }: Props) {
  const { t } = useI18n()

  if (!controlRoom) {
    return (
      <Card title={t.commandCenter.sections.controlRoomPreview}>
        <div className="acMuted">{t.commandCenter.empty.controlRoom}</div>
      </Card>
    )
  }

  const working = controlRoom.workNow.currentlyWorking.length
  const blocked = controlRoom.workNow.blocked.length
  const pending = controlRoom.pendingApprovals.length

  return (
    <Card
      title={t.commandCenter.sections.controlRoomPreview}
      action={
        <Link to={AI_PHOTO_LAB_CONTROL_ROOM_PATH} className="acLink">
          {t.executiveDashboard.actionOpenControlRoom}
        </Link>
      }
    >
      <div className="mcCommandCenterControlRoomGoal">{controlRoom.goal}</div>
      <div className="mcCommandCenterSprintMeta">
        <span className={`mcControlRoomBadge mcControlRoomHealth${controlRoom.health}`}>
          {t.photoLabControlRoom.healthLevels[controlRoom.health]}
        </span>
        <span className={`mcControlRoomBadge mcControlRoomRisk${controlRoom.riskLevel}`}>
          {t.photoLabControlRoom.riskLevels[controlRoom.riskLevel]}
        </span>
        <span className="mcMono">{controlRoom.progress}%</span>
      </div>
      <div className="mcCommandCenterPreviewStats" style={{ marginTop: 12 }}>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{working}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.controlRoomWorking}</span>
        </div>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{blocked}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.controlRoomBlocked}</span>
        </div>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{pending}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.controlRoomApprovals}</span>
        </div>
      </div>
    </Card>
  )
}
