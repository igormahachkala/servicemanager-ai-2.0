import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function DemoReadinessChecklist({ snapshot }: Props) {
  const { t } = useI18n()
  const ready = snapshot.demoChecklist.filter((item) => item.status === 'done').length

  return (
    <Panel title={t.photoLabControlRoom.sections.demoReadiness}>
      <div className="mcProfilePanelBody">
        <div className="mcControlRoomDemoMeta">
          {ready}/{snapshot.demoChecklist.length} {t.photoLabControlRoom.demoReady}
        </div>
        <ul className="mcControlRoomDemoList">
          {snapshot.demoChecklist.map((item) => (
            <li key={item.key} className={`mcControlRoomDemoItem mcControlRoomDemo${item.status}`}>
              <span className="mcControlRoomDemoCheck">
                {item.status === 'done' ? '✓' : item.status === 'blocked' ? '!' : '○'}
              </span>
              <span>{t.photoLabControlRoom.demoItems[item.key]}</span>
              <span className="mcControlRoomBadge">{item.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
