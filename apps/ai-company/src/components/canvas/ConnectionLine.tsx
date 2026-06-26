import { useMemo } from 'react'
import type { CanvasConnection, CanvasGraph, CanvasNode } from '../../domain/canvas'
import { nodePort } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  connection: CanvasConnection
  fromNode: CanvasNode
  toNode: CanvasNode
  selected: boolean
  highlighted: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const curvature = Math.max(56, Math.max(dx, dy) * 0.38)
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    return `M ${from.x} ${from.y} C ${from.x + curvature} ${from.y}, ${to.x - curvature} ${to.y}, ${to.x} ${to.y}`
  }
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + curvature}, ${to.x} ${to.y - curvature}, ${to.x} ${to.y}`
}

export function ConnectionLine({
  connection,
  fromNode,
  toNode,
  selected,
  highlighted,
  onSelect,
  onHover,
}: Props) {
  const { t } = useI18n()
  const toCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 }
  const fromCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 }
  const from = nodePort(fromNode, toCenter)
  const to = nodePort(toNode, fromCenter)
  const path = bezierPath(from, to)
  const label = connection.label ?? t.canvasEngine.connectionTypes[connection.type]
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  const className = [
    'acCanvasConnection',
    `acCanvasConnection${capitalize(connection.type)}`,
    connection.animated ? ' acCanvasConnectionAnimated' : '',
    selected ? ' acCanvasConnectionSelected' : '',
    highlighted ? ' acCanvasConnectionHighlighted' : '',
  ].join('')

  return (
    <g
      className={className}
      data-connection-type={connection.type}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <path d={path} className="acCanvasConnectionHit" />
      <path d={path} className="acCanvasConnectionGlow" />
      <path
        d={path}
        className="acCanvasConnectionPath"
        markerEnd={`url(#acCanvasArrow-${connection.type})`}
      />
      {(highlighted || selected) && (
        <g className="acCanvasConnectionLabelGroup">
          <rect
            x={midX - 42}
            y={midY - 16}
            width={84}
            height={18}
            rx={6}
            className="acCanvasConnectionLabelBg"
          />
          <text x={midX} y={midY - 3} className="acCanvasConnectionLabel">
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

type ConnectionLayerProps = {
  graph: CanvasGraph
  selectedConnectionId: string | null
  hoveredConnectionId: string | null
  selectedNodeId: string | null
  onSelectConnection: (connectionId: string | null) => void
  onHoverConnection: (connectionId: string | null) => void
}

export function ConnectionLayer({
  graph,
  selectedConnectionId,
  hoveredConnectionId,
  selectedNodeId,
  onSelectConnection,
  onHoverConnection,
}: ConnectionLayerProps) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  )

  return (
    <svg className="acCanvasConnections" aria-hidden>
      <defs>
        {(['assignment', 'execution', 'runtime', 'report', 'approval', 'knowledge', 'tool', 'chat'] as const).map(
          (type) => (
            <marker
              key={type}
              id={`acCanvasArrow-${type}`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              className={`acCanvasArrow acCanvasArrow${capitalize(type)}`}
            >
              <path d="M0,0 L8,4 L0,8 Z" />
            </marker>
          ),
        )}
      </defs>
      {graph.connections.map((connection) => {
        const fromNode = nodeById.get(connection.fromId)
        const toNode = nodeById.get(connection.toId)
        if (!fromNode || !toNode) return null
        const highlighted =
          hoveredConnectionId === connection.id ||
          selectedNodeId === connection.fromId ||
          selectedNodeId === connection.toId
        return (
          <ConnectionLine
            key={connection.id}
            connection={connection}
            fromNode={fromNode}
            toNode={toNode}
            selected={selectedConnectionId === connection.id}
            highlighted={highlighted}
            onSelect={() =>
              onSelectConnection(selectedConnectionId === connection.id ? null : connection.id)
            }
            onHover={(hovered) => onHoverConnection(hovered ? connection.id : null)}
          />
        )
      })}
    </svg>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
