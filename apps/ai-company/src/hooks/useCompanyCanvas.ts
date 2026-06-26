import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  DEFAULT_CANVAS_LAYERS,
  DEFAULT_CANVAS_VIEWPORT,
  applyCanvasLayers,
  buildCanvasGraph,
  getCanvasNodeDetails,
  getCanvasSummary,
  loadCanvasViewport,
  saveCanvasViewport,
  tickCanvasLive,
  type BuildCanvasGraphInput,
  type CanvasGraph,
  type CanvasLayerId,
  type CanvasMode,
  type CanvasNode,
  type CanvasNodeDetails,
  type CanvasSummary,
  type CanvasViewportState,
} from '../domain/canvas'

type UseCompanyCanvasOptions = {
  initialMode?: CanvasMode
  projectId?: string | null
}

export function useCompanyCanvas(options: UseCompanyCanvasOptions = {}) {
  const initialMode = options.initialMode ?? 'company'
  const projectId = options.projectId ?? null

  const buildInput = useMemo<BuildCanvasGraphInput>(
    () => ({ mode: initialMode, projectId }),
    [initialMode, projectId],
  )

  const [mode, setMode] = useState<CanvasMode>(initialMode)
  const [graph, setGraph] = useState<CanvasGraph>(() => buildCanvasGraph({ mode: initialMode, projectId }))
  const [viewport, setViewport] = useState<CanvasViewportState>(() => loadCanvasViewport())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [layers, setLayers] = useState<Record<CanvasLayerId, boolean>>(DEFAULT_CANVAS_LAYERS)
  const [layersOpen, setLayersOpen] = useState(false)

  const refresh = useCallback(() => {
    setGraph(buildCanvasGraph({ mode, projectId }))
  }, [mode, projectId])

  useEffect(() => {
    setGraph(buildCanvasGraph({ mode, projectId }))
    setSelectedId(null)
    setSelectedConnectionId(null)
  }, [mode, projectId])

  useEffect(() => {
    saveCanvasViewport(viewport)
  }, [viewport])

  useEffect(() => {
    if (!liveEnabled) return undefined
    const timer = window.setInterval(() => {
      setGraph((current) => tickCanvasLive(current))
    }, 2400)
    return () => window.clearInterval(timer)
  }, [liveEnabled, mode, projectId])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-presence' ||
        event.key === 'ai-company-executions' ||
        event.key === 'ai-company-approvals' ||
        event.key === 'ai-company-runtime-runs'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const visibleGraph = useMemo(() => applyCanvasLayers(graph, layers), [graph, layers])

  const selected = useMemo(
    () => getCanvasNodeDetails(visibleGraph, selectedId),
    [visibleGraph, selectedId],
  )

  const summary = useMemo(() => getCanvasSummary(visibleGraph), [visibleGraph])

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((current) => ({ ...current, panX: current.panX + dx, panY: current.panY + dy }))
  }, [])

  const zoomBy = useCallback((delta: number, anchorX = 0, anchorY = 0) => {
    setViewport((current) => {
      const nextZoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, current.zoom + delta))
      const ratio = nextZoom / current.zoom
      return {
        panX: anchorX - (anchorX - current.panX) * ratio,
        panY: anchorY - (anchorY - current.panY) * ratio,
        zoom: nextZoom,
      }
    })
  }, [])

  const resetView = useCallback(() => {
    setViewport(DEFAULT_CANVAS_VIEWPORT)
  }, [])

  const fitView = useCallback(() => {
    const { bounds } = visibleGraph
    const padding = 48
    const scaleX = (960 - padding * 2) / bounds.width
    const scaleY = (640 - padding * 2) / bounds.height
    const zoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.min(scaleX, scaleY, 1)))
    setViewport({
      zoom,
      panX: padding - bounds.minX * zoom,
      panY: padding - bounds.minY * zoom,
    })
  }, [visibleGraph])

  const selectNode = useCallback((node: CanvasNode | null) => {
    setSelectedId(node?.id ?? null)
    setSelectedConnectionId(null)
  }, [])

  const selectConnection = useCallback((connectionId: string | null) => {
    setSelectedConnectionId(connectionId)
    if (connectionId) setSelectedId(null)
  }, [])

  const toggleLayer = useCallback((layer: CanvasLayerId) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }))
  }, [])

  return {
    mode,
    setMode,
    graph: visibleGraph,
    rawGraph: graph,
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
    projectId,
    buildInput,
  }
}

export type {
  CanvasGraph,
  CanvasMode,
  CanvasNode,
  CanvasNodeDetails,
  CanvasSummary,
  CanvasViewportState,
}
