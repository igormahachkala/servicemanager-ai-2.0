import {
  CanvasInspector,
  CanvasMiniMap,
  CanvasToolbar,
  CanvasViewport,
} from '../components/canvas'
import { useCompanyCanvas } from '../hooks/useCompanyCanvas'
import { PageHeader } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function CompanyCanvasPage() {
  const { t } = useI18n()
  const {
    mode,
    setMode,
    graph,
    viewport,
    setViewport,
    selectedId,
    selected,
    selectNode,
    panBy,
    zoomBy,
    resetView,
    fitView,
    refresh,
    liveEnabled,
    setLiveEnabled,
  } = useCompanyCanvas('company')

  return (
    <>
      <PageHeader title={t.pages.canvas} description={t.canvasEngine.pageDescription} />

      <div className="acCanvasPage">
        <CanvasToolbar
          mode={mode}
          liveEnabled={liveEnabled}
          zoom={viewport.zoom}
          nodeCount={graph.nodes.length}
          connectionCount={graph.connections.length}
          onModeChange={setMode}
          onLiveToggle={() => setLiveEnabled((value) => !value)}
          onZoomIn={() => zoomBy(0.12)}
          onZoomOut={() => zoomBy(-0.12)}
          onResetView={resetView}
          onFitView={fitView}
          onRefresh={refresh}
        />

        <div className="acCanvasLayout">
          <div className="acCanvasStage">
            <CanvasViewport
              graph={graph}
              viewport={viewport}
              selectedId={selectedId}
              onSelectNode={(nodeId) => selectNode(graph.nodes.find((item) => item.id === nodeId) ?? null)}
              onPanBy={panBy}
              onZoomBy={zoomBy}
            />
            <CanvasMiniMap
              graph={graph}
              viewport={viewport}
              selectedId={selectedId}
              onJumpTo={(panX, panY) => setViewport((current) => ({ ...current, panX, panY }))}
            />
          </div>

          <aside className="acCanvasSide">
            <CanvasInspector inspector={selected} />
          </aside>
        </div>

        <p className="acCanvasFutureNote">{t.canvasEngine.futureStreaming}</p>
      </div>
    </>
  )
}
