import type { CanvasConnection, CanvasGraph, CanvasNode } from '../../domain/canvas'
import { nodeCenter } from '../../domain/canvas'

type Props = {
  connection: CanvasConnection
  fromNode: CanvasNode
  toNode: CanvasNode
}

function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.abs(to.x - from.x)
  const curvature = Math.max(48, dx * 0.35)
  return `M ${from.x} ${from.y} C ${from.x + curvature} ${from.y}, ${to.x - curvature} ${to.y}, ${to.x} ${to.y}`
}

export function ConnectionLine({ connection, fromNode, toNode }: Props) {
  const from = nodeCenter(fromNode)
  const to = nodeCenter(toNode)
  const path = bezierPath(from, to)
  const className = [
    'acCanvasConnection',
    `acCanvasConnection${capitalize(connection.type)}`,
    connection.animated ? ' acCanvasConnectionAnimated' : '',
  ].join('')

  return (
    <g className={className} data-connection-type={connection.type}>
      <path d={path} className="acCanvasConnectionPath" />
      {connection.label ? (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 6}
          className="acCanvasConnectionLabel"
        >
          {connection.label}
        </text>
      ) : null}
    </g>
  )
}

type ConnectionLayerProps = {
  graph: CanvasGraph
}

export function ConnectionLayer({ graph }: ConnectionLayerProps) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))

  return (
    <svg className="acCanvasConnections" aria-hidden>
      {graph.connections.map((connection) => {
        const fromNode = nodeById.get(connection.fromId)
        const toNode = nodeById.get(connection.toId)
        if (!fromNode || !toNode) return null
        return (
          <ConnectionLine
            key={connection.id}
            connection={connection}
            fromNode={fromNode}
            toNode={toNode}
          />
        )
      })}
    </svg>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
