import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  DEFAULT_CANVAS_VIEWPORT,
  buildCanvasGraph,
  getCanvasInspector,
  loadCanvasViewport,
  saveCanvasViewport,
  tickCanvasLive,
  type CanvasGraph,
  type CanvasMode,
  type CanvasNode,
  type CanvasViewportState,
} from '../domain/canvas'

export function useCompanyCanvas(initialMode: CanvasMode = 'company') {
  const [mode, setMode] = useState<CanvasMode>(initialMode)
  const [graph, setGraph] = useState<CanvasGraph>(() => buildCanvasGraph(initialMode))
  const [viewport, setViewport] = useState<CanvasViewportState>(() => loadCanvasViewport())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveEnabled, setLiveEnabled] = useState(true)

  const refresh = useCallback(() => {
    setGraph(buildCanvasGraph(mode))
  }, [mode])

  useEffect(() => {
    setGraph(buildCanvasGraph(mode))
    setSelectedId(null)
  }, [mode])

  useEffect(() => {
    saveCanvasViewport(viewport)
  }, [viewport])

  useEffect(() => {
    if (!liveEnabled) return undefined
    const timer = window.setInterval(() => {
      setGraph((current) => tickCanvasLive(current))
    }, 2800)
    return () => window.clearInterval(timer)
  }, [liveEnabled, mode])

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

  const selected = useMemo(
    () => getCanvasInspector(graph, selectedId),
    [graph, selectedId],
  )

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
    const { bounds } = graph
    const padding = 48
    const scaleX = (960 - padding * 2) / bounds.width
    const scaleY = (640 - padding * 2) / bounds.height
    const zoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.min(scaleX, scaleY, 1)))
    setViewport({
      zoom,
      panX: padding - bounds.minX * zoom,
      panY: padding - bounds.minY * zoom,
    })
  }, [graph])

  const selectNode = useCallback((node: CanvasNode | null) => {
    setSelectedId(node?.id ?? null)
  }, [])

  return {
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
  }
}

export type { CanvasGraph, CanvasMode, CanvasNode, CanvasViewportState }
