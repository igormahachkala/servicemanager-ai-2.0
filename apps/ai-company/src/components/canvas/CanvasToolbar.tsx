import { CANVAS_LAYERS, CANVAS_MODES, type CanvasLayerId, type CanvasMode } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  mode: CanvasMode
  liveEnabled: boolean
  zoom: number
  nodeCount: number
  connectionCount: number
  layers: Record<CanvasLayerId, boolean>
  layersOpen: boolean
  projectLabel: string | null
  onModeChange: (mode: CanvasMode) => void
  onLiveToggle: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitView: () => void
  onRefresh: () => void
  onToggleLayer: (layer: CanvasLayerId) => void
  onToggleLayersPanel: () => void
}

export function CanvasToolbar({
  mode,
  liveEnabled,
  zoom,
  nodeCount,
  connectionCount,
  layers,
  layersOpen,
  projectLabel,
  onModeChange,
  onLiveToggle,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  onRefresh,
  onToggleLayer,
  onToggleLayersPanel,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="acCanvasToolbarWrap">
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
          {projectLabel ? <span className="acCanvasProjectBadge">{projectLabel}</span> : null}
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
          <button
            type="button"
            className={layersOpen ? 'acCanvasToolBtn acCanvasToolBtnActive' : 'acCanvasToolBtn'}
            onClick={onToggleLayersPanel}
          >
            {t.canvasEngine.layers}
          </button>
        </div>
      </div>

      {layersOpen ? (
        <div className="acCanvasLayersPanel">
          {CANVAS_LAYERS.map((layer) => (
            <label key={layer} className="acCanvasLayerToggle">
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={() => onToggleLayer(layer)}
              />
              <span>{t.canvasEngine.layerLabels[layer]}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
