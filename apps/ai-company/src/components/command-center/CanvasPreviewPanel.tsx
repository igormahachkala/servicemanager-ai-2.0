import { Link } from 'react-router-dom'
import type { CanvasSummary } from '../../domain/canvas/canvas'
import { AI_PHOTO_LAB_PROJECT_ID } from '../../domain/projects/aiPhotoLabIds'
import { Card } from '../layout'
import { useI18n } from '../../i18n'

type Props = {
  canvas: CanvasSummary | null
}

const CANVAS_PATH = `/ops/canvas?projectId=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`

export function CanvasPreviewPanel({ canvas }: Props) {
  const { t } = useI18n()

  if (!canvas) {
    return (
      <Card title={t.commandCenter.sections.canvasPreview}>
        <div className="acMuted">{t.commandCenter.empty.canvas}</div>
      </Card>
    )
  }

  return (
    <Card
      title={t.commandCenter.sections.canvasPreview}
      action={<Link to={CANVAS_PATH} className="acLink">{t.executiveDashboard.actionOpenCanvas}</Link>}
    >
      <div className="mcCommandCenterPreviewStats">
        <div>
          <span className="mcCommandCenterPreviewStatValue">{canvas.stats.employees}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.canvasEmployees}</span>
        </div>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{canvas.stats.tasks}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.canvasTasks}</span>
        </div>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{canvas.stats.approvals}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.canvasApprovals}</span>
        </div>
        <div>
          <span className="mcCommandCenterPreviewStatValue">{canvas.stats.runs}</span>
          <span className="mcCommandCenterPreviewStatLabel">{t.commandCenter.canvasRuns}</span>
        </div>
      </div>
      <div className="mcCommandCenterPreviewList">
        {canvas.runningTasks.slice(0, 3).map((node) => (
          <div key={node.id} className="mcCommandCenterPreviewRow">
            <span>{node.label}</span>
            <span className="acMono acMuted">{node.liveStatus ?? 'active'}</span>
          </div>
        ))}
        {canvas.runningTasks.length === 0 ? (
          <div className="acMuted">{t.commandCenter.empty.canvasTasks}</div>
        ) : null}
      </div>
    </Card>
  )
}
