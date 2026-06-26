import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CanvasInspector,
  CanvasMiniMap,
  CanvasToolbar,
  CanvasViewport,
} from '../components/canvas'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import { getProjectById } from '../domain/projects/project'
import { useCompanyCanvas } from '../hooks/useCompanyCanvas'
import { useI18n } from '../i18n'

export function CompanyCanvasPage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')
  const focusProject = projectId === AI_PHOTO_LAB_PROJECT_ID
  const project = projectId ? getProjectById(projectId) : null

  const {
    mode,
    setMode,
    graph,
    rawGraph,
    viewport,
    setViewport,
    selectedId,
    selectedConnectionId,
    selected,
    summary,
    selectNode,
    selectConnection,
    panBy,
    zoomBy,
    resetView,
    fitView,
    refresh,
    liveEnabled,
    setLiveEnabled,
    layers,
    toggleLayer,
    layersOpen,
    setLayersOpen,
  } = useCompanyCanvas({
    initialMode: focusProject ? 'project' : 'company',
    projectId,
  })

  const selectedConnectionLabel = useMemo(() => {
    if (!selectedConnectionId) return null
    const connection = graph.connections.find((item) => item.id === selectedConnectionId)
    if (!connection) return null
    return connection.label ?? t.canvasEngine.connectionTypes[connection.type]
  }, [graph.connections, selectedConnectionId, t.canvasEngine.connectionTypes])

  return (
    <div className="acCanvasPage acCanvasPagePremium">
      <header className="acCanvasPageHeader">
        <div>
          <h1 className="acCanvasPageTitle">{t.pages.canvas}</h1>
          <p className="acCanvasPageDescription">
            {focusProject && project
              ? t.canvasEngine.projectFocusDescription.replace('{project}', project.title)
              : t.canvasEngine.pageDescription}
          </p>
        </div>
        {focusProject && project ? (
          <div className="acCanvasHeaderActions">
            <span className="acCanvasProjectBadge acCanvasProjectBadgeLarge">{project.title}</span>
            <Link to="/ops/projects/project-ai-photo-lab/control-room" className="mcBtn mcBtnPrimary mcBtnSmall">
              {t.photoLabControlRoom.openControlRoom}
            </Link>
            <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.pages.handoffs}
            </Link>
          </div>
        ) : null}
      </header>

      <CanvasToolbar
        mode={mode}
        liveEnabled={liveEnabled}
        zoom={viewport.zoom}
        nodeCount={graph.nodes.length}
        connectionCount={graph.connections.length}
        layers={layers}
        layersOpen={layersOpen}
        projectLabel={focusProject && project ? project.title : null}
        onModeChange={setMode}
        onLiveToggle={() => setLiveEnabled((value) => !value)}
        onZoomIn={() => zoomBy(0.12)}
        onZoomOut={() => zoomBy(-0.12)}
        onResetView={resetView}
        onFitView={fitView}
        onRefresh={refresh}
        onToggleLayer={toggleLayer}
        onToggleLayersPanel={() => setLayersOpen((value) => !value)}
      />

      <div className="acCanvasLayout">
        <div className="acCanvasStage">
          <CanvasViewport
            graph={graph}
            viewport={viewport}
            selectedId={selectedId}
            selectedConnectionId={selectedConnectionId}
            liveEvents={rawGraph.liveEvents}
            onSelectNode={(nodeId) => selectNode(graph.nodes.find((item) => item.id === nodeId) ?? null)}
            onSelectConnection={selectConnection}
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
          <CanvasInspector
            details={selected}
            summary={summary}
            selectedConnectionLabel={selectedConnectionLabel}
          />
        </aside>
      </div>
    </div>
  )
}
