import type { CanvasNode } from '../../domain/canvas'
import { CanvasNodeShell, shellProps } from './canvasNodeShared'

export function ProjectNode(props: {
  node: CanvasNode
  selected: boolean
  onSelect: () => void
}) {
  return <CanvasNodeShell {...shellProps(props)} />
}
