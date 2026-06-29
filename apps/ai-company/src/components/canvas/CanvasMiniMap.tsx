import type { CanvasGraph, CanvasViewportState } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  graph: CanvasGraph
  viewport: CanvasViewportState
  selectedId: string | null
  onJumpTo: (panX: number, panY: number) => void
}

const MINI_WIDTH = 168
const MINI_HEIGHT = 112

export function CanvasMiniMap({ graph, viewport, selectedId, onJumpTo }: Props) {
  const { t } = useI18n()
  const { bounds } = graph
  const scale = Math.min(MINI_WIDTH / bounds.width, MINI_HEIGHT / bounds.height)
  const offsetX = (MINI_WIDTH - bounds.width * scale) / 2
  const offsetY = (MINI_HEIGHT - bounds.height * scale) / 2

  const viewW = 960 / viewport.zoom
  const viewH = 640 / viewport.zoom
  const viewX = (-viewport.panX / viewport.zoom) - bounds.minX
  const viewY = (-viewport.panY / viewport.zoom) - bounds.minY

  return (
    <div className="acCanvasMiniMap">
      <svg width={MINI_WIDTH} height={MINI_HEIGHT} className="acCanvasMiniMapSvg">
        <rect
          x={offsetX}
          y={offsetY}
          width={bounds.width * scale}
          height={bounds.height * scale}
          className="acCanvasMiniMapBounds"
        />
        {graph.nodes.map((node) => (
          <rect
            key={node.id}
            x={offsetX + (node.x - bounds.minX) * scale}
            y={offsetY + (node.y - bounds.minY) * scale}
            width={Math.max(4, node.width * scale * 0.35)}
            height={Math.max(3, node.height * scale * 0.35)}
            className={
              selectedId === node.id ? 'acCanvasMiniMapNode acCanvasMiniMapNodeSelected' : 'acCanvasMiniMapNode'
            }
          />
        ))}
        <rect
          x={offsetX + viewX * scale}
          y={offsetY + viewY * scale}
          width={Math.max(12, viewW * scale)}
          height={Math.max(10, viewH * scale)}
          className="acCanvasMiniMapViewport"
        />
      </svg>
      <button
        type="button"
        className="acCanvasMiniMapHit"
        aria-label={t.canvasEngine.miniMapAria}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top
          const worldX = bounds.minX + (x - offsetX) / scale
          const worldY = bounds.minY + (y - offsetY) / scale
          onJumpTo(480 - worldX * viewport.zoom, 320 - worldY * viewport.zoom)
        }}
      />
    </div>
  )
}
