import { useCallback, useRef } from 'react'
import type { CanvasGraph, CanvasViewportState } from '../../domain/canvas'
import { CanvasNodeRenderer } from './CanvasNodeRenderer'
import { ConnectionLayer } from './ConnectionLine'

type Props = {
  graph: CanvasGraph
  viewport: CanvasViewportState
  selectedId: string | null
  onSelectNode: (nodeId: string | null) => void
  onPanBy: (dx: number, dy: number) => void
  onZoomBy: (delta: number, anchorX?: number, anchorY?: number) => void
}

export function CanvasViewport({
  graph,
  viewport,
  selectedId,
  onSelectNode,
  onPanBy,
  onZoomBy,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      dragRef.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [],
  )

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
    event.currentTarget.releasePointerCapture(event.pointerId)
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
      onClick={() => onSelectNode(null)}
    >
      <div
        className="acCanvasWorld"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <ConnectionLayer graph={graph} />
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
    </div>
  )
}
