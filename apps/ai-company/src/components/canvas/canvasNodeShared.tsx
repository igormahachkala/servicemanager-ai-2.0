import type { ReactNode } from 'react'
import type { CanvasLiveStatus, CanvasNodeKind } from '../../domain/canvas'
import { LiveIndicator } from './LiveIndicator'

type CanvasNodeShellProps = {
  nodeId: string
  kind: CanvasNodeKind
  label: string
  subtitle: string | null
  liveStatus: CanvasLiveStatus | null
  selected: boolean
  x: number
  y: number
  width: number
  height: number
  onSelect: () => void
  children?: ReactNode
}

export function CanvasNodeShell(props: CanvasNodeShellProps) {
  return (
    <button
      type="button"
      className={`acCanvasNode acCanvasNode${capitalize(props.kind)}${props.selected ? ' acCanvasNodeSelected' : ''}`}
      style={{
        left: props.x,
        top: props.y,
        width: props.width,
        height: props.height,
      }}
      onClick={(event) => {
        event.stopPropagation()
        props.onSelect()
      }}
    >
      <div className="acCanvasNodeHead">
        <span className="acCanvasNodeKind">{props.kind}</span>
        {props.liveStatus ? <LiveIndicator status={props.liveStatus} /> : null}
      </div>
      <div className="acCanvasNodeTitle">{props.label}</div>
      {props.subtitle ? <div className="acCanvasNodeSub">{props.subtitle}</div> : null}
      {props.children}
    </button>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function shellProps(props: {
  node: import('../../domain/canvas').CanvasNode
  selected: boolean
  onSelect: () => void
}) {
  return {
    nodeId: props.node.id,
    kind: props.node.kind,
    label: props.node.label,
    subtitle: props.node.subtitle,
    liveStatus: props.node.liveStatus,
    selected: props.selected,
    x: props.node.x,
    y: props.node.y,
    width: props.node.width,
    height: props.node.height,
    onSelect: props.onSelect,
  }
}

export { shellProps }
