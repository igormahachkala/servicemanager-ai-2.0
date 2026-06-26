import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { CanvasLiveStatus, CanvasNodeKind } from '../../domain/canvas'
import { canvasNodeAccent, canvasNodeIcon } from './canvasNodeIcons'
import { LiveIndicator } from './LiveIndicator'

type CanvasNodeShellProps = {
  nodeId: string
  kind: CanvasNodeKind
  label: string
  subtitle: string | null
  meta: string | null
  href: string | null
  liveStatus: CanvasLiveStatus | null
  selected: boolean
  pulse: number
  x: number
  y: number
  width: number
  height: number
  onSelect: () => void
  children?: ReactNode
}

export function CanvasNodeShell(props: CanvasNodeShellProps) {
  const accent = canvasNodeAccent(props.kind)
  const isLive = props.liveStatus && props.liveStatus !== 'completed'

  return (
    <button
      type="button"
      className={`acCanvasNode acCanvasNode${capitalize(props.kind)}${props.selected ? ' acCanvasNodeSelected' : ''}${isLive ? ' acCanvasNodeLive' : ''}`}
      style={{
        left: props.x,
        top: props.y,
        width: props.width,
        height: props.height,
        ['--acCanvasAccent' as string]: accent,
      }}
      onClick={(event) => {
        event.stopPropagation()
        props.onSelect()
      }}
    >
      <div className="acCanvasNodeGlow" aria-hidden />
      <div className="acCanvasNodeInner">
        <div className="acCanvasNodeTop">
          <span className="acCanvasNodeIcon" aria-hidden>
            {canvasNodeIcon(props.kind)}
          </span>
          <div className="acCanvasNodeHeadText">
            <span className="acCanvasNodeKind">{props.kind}</span>
            {props.liveStatus ? <LiveIndicator status={props.liveStatus} compact /> : null}
          </div>
          {props.href ? (
            <Link
              to={props.href}
              className="acCanvasNodeOpen"
              aria-label="Open"
              onClick={(event) => event.stopPropagation()}
            >
              ↗
            </Link>
          ) : null}
        </div>
        <div className="acCanvasNodeTitle">{props.label}</div>
        {props.subtitle ? <div className="acCanvasNodeSub">{props.subtitle}</div> : null}
        {props.meta ? <div className="acCanvasNodeMeta">{props.meta}</div> : null}
        {props.children}
      </div>
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
    meta: props.node.meta,
    href: props.node.href,
    liveStatus: props.node.liveStatus,
    pulse: props.node.pulse,
    selected: props.selected,
    x: props.node.x,
    y: props.node.y,
    width: props.node.width,
    height: props.node.height,
    onSelect: props.onSelect,
  }
}

export { shellProps }
