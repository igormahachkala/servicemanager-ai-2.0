import { Link } from 'react-router-dom'
import { HandoffCard } from '../../handoff'
import { listHandoffs } from '../../../domain/handoff'
import { AI_PHOTO_LAB_PROJECT_ID } from '../../../domain/projects/aiPhotoLabIds'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function CodexHandoffPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const handoffs = listHandoffs({ projectId: AI_PHOTO_LAB_PROJECT_ID, workspaceId: 'all', employeeId: 'all', target: 'all', status: 'all' })

  return (
    <Panel
      title={t.photoLabControlRoom.sections.codexHandoff}
      right={
        <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary mcBtnSm">
          {t.pages.handoffs}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        <p className="mcControlRoomNote">{t.photoLabControlRoom.codexNote}</p>
        {handoffs.length > 0 ? (
          <div className="acHandoffList" style={{ marginBottom: 16 }}>
            {handoffs.slice(0, 4).map((handoff) => (
              <HandoffCard key={handoff.id} handoff={handoff} compact />
            ))}
          </div>
        ) : null}
        <ul className="mcControlRoomCodexList">
          {snapshot.codexHandoff.map((item) => (
            <li key={item.id} className="mcControlRoomCodexCard">
              <div className="mcControlRoomCodexHead">
                <span className="mcControlRoomCodexCategory">
                  {t.photoLabControlRoom.codexCategories[item.category]}
                </span>
                <span className={`mcControlRoomBadge mcControlRoomPriority${item.priority}`}>
                  {item.priority}
                </span>
              </div>
              <div className="mcControlRoomCodexTitle">{item.title}</div>
              <p className="mcMuted">{item.description}</p>
              <p className="mcControlRoomCodexRationale">{item.rationale}</p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
