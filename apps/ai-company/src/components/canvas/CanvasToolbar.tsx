import { CANVAS_MODES, type CanvasMode } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  mode: CanvasMode
  liveEnabled: boolean
  zoom: number
  nodeCount: number
  connectionCount: number
  onModeChange: (mode: CanvasMode) => void
  onLiveToggle: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitView: () => void
  onRefresh: () => void
}

export function CanvasToolbar({
  mode,
  liveEnabled,
  zoom,
  nodeCount,
  connectionCount,
  onModeChange,
  onLiveToggle,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  onRefresh,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="acCanvasToolbar">
      <div className="acCanvasToolbarGroup">
        {CANVAS_MODES.map((item) => (
          <button
            key={item}
            type="button"
            className={item === mode ? 'acCanvasModeBtn acCanvasModeBtnActive' : 'acCanvasModeBtn'}
            onClick={() => onModeChange(item)}
          >
            {t.canvasEngine.modes[item]}
          </button>
        ))}
      </div>

      <div className="acCanvasToolbarGroup acCanvasToolbarMeta">
        <span className="acCanvasMeta">
          {nodeCount} {t.canvasEngine.nodes} · {connectionCount} {t.canvasEngine.connections}
        </span>
        <button
          type="button"
          className={liveEnabled ? 'acCanvasLiveToggle acCanvasLiveToggleOn' : 'acCanvasLiveToggle'}
          onClick={onLiveToggle}
        >
          {liveEnabled ? t.canvasEngine.liveOn : t.canvasEngine.liveOff}
        </button>
      </div>

      <div className="acCanvasToolbarGroup">
        <button type="button" className="acCanvasToolBtn" onClick={onZoomOut} aria-label={t.canvasEngine.zoomOut}>
          −
        </button>
        <span className="acCanvasZoomLabel">{Math.round(zoom * 100)}%</span>
        <button type="button" className="acCanvasToolBtn" onClick={onZoomIn} aria-label={t.canvasEngine.zoomIn}>
          +
        </button>
        <button type="button" className="acCanvasToolBtn" onClick={onFitView}>
          {t.canvasEngine.fitView}
        </button>
        <button type="button" className="acCanvasToolBtn" onClick={onResetView}>
          {t.canvasEngine.resetView}
        </button>
        <button type="button" className="acCanvasToolBtn" onClick={onRefresh}>
          {t.canvasEngine.refresh}
        </button>
      </div>
    </div>
  )
}
