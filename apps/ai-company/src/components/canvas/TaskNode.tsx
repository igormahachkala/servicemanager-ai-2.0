import type { CanvasNode } from '../../domain/canvas'
import { CanvasNodeShell, shellProps } from './canvasNodeShared'

export function TaskNode(props: {
  node: CanvasNode
  selected: boolean
  onSelect: () => void
}) {
  return <CanvasNodeShell {...shellProps(props)} />
}
