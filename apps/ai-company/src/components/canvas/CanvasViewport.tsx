import { useCallback, useRef, useState } from 'react'
import type { CanvasGraph, CanvasLiveEvent, CanvasViewportState } from '../../domain/canvas'
import { CanvasNodeRenderer } from './CanvasNodeRenderer'
import { ConnectionLayer } from './ConnectionLine'
import { CanvasActivityTicker } from './CanvasActivityTicker'

type Props = {
  graph: CanvasGraph
  viewport: CanvasViewportState
  selectedId: string | null
  selectedConnectionId: string | null
  liveEvents: CanvasLiveEvent[]
  onSelectNode: (nodeId: string | null) => void
  onSelectConnection: (connectionId: string | null) => void
  onPanBy: (dx: number, dy: number) => void
  onZoomBy: (delta: number, anchorX?: number, anchorY?: number) => void
}

export function CanvasViewport({
  graph,
  viewport,
  selectedId,
  selectedConnectionId,
  liveEvents,
  onSelectNode,
  onSelectConnection,
  onPanBy,
  onZoomBy,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null)

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('.acCanvasNode') || target.closest('.acCanvasConnection')) return
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const dx = event.clientX - dragRef.current.x
      const dy = event.clientY - dragRef.current.y
      dragRef.current = { x: event.clientX, y: event.clientY }
      onPanBy(dx, dy)
    },
    [onPanBy],
  )

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault()
      const rect = rootRef.current?.getBoundingClientRect()
      const anchorX = rect ? event.clientX - rect.left : 0
      const anchorY = rect ? event.clientY - rect.top : 0
      const delta = event.deltaY > 0 ? -0.08 : 0.08
      onZoomBy(delta, anchorX, anchorY)
    },
    [onZoomBy],
  )

  return (
    <div
      ref={rootRef}
      className="acCanvasViewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      onClick={() => {
        onSelectNode(null)
        onSelectConnection(null)
      }}
    >
      <div className="acCanvasGrid" aria-hidden />
      <div
        className="acCanvasWorld"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <ConnectionLayer
          graph={graph}
          selectedConnectionId={selectedConnectionId}
          hoveredConnectionId={hoveredConnectionId}
          selectedNodeId={selectedId}
          onSelectConnection={onSelectConnection}
          onHoverConnection={setHoveredConnectionId}
        />
        <div className="acCanvasNodes">
          {graph.nodes.map((node) => (
            <CanvasNodeRenderer
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              onSelect={() => onSelectNode(node.id)}
            />
          ))}
        </div>
      </div>
      <CanvasActivityTicker events={liveEvents} />
    </div>
  )
}
