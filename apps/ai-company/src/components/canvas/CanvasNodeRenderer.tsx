import type { ReactElement } from 'react'
import type { CanvasNode, CanvasNodeKind } from '../../domain/canvas'
import { ApprovalNode } from './ApprovalNode'
import { EmployeeNode } from './EmployeeNode'
import { KnowledgeNode } from './KnowledgeNode'
import { ProjectNode } from './ProjectNode'
import { ReportNode } from './ReportNode'
import { RunNode } from './RunNode'
import { RuntimeNode } from './RuntimeNode'
import { TaskNode } from './TaskNode'
import { ToolNode } from './ToolNode'
import { WorkspaceNode } from './WorkspaceNode'

type Props = {
  node: CanvasNode
  selected: boolean
  onSelect: () => void
}

const RENDERERS: Record<
  CanvasNodeKind,
  (props: Props) => ReactElement
> = {
  employee: EmployeeNode,
  project: ProjectNode,
  workspace: WorkspaceNode,
  task: TaskNode,
  runtime: RuntimeNode,
  run: RunNode,
  report: ReportNode,
  approval: ApprovalNode,
  knowledge: KnowledgeNode,
  tool: ToolNode,
}

export function CanvasNodeRenderer(props: Props) {
  const Component = RENDERERS[props.node.kind]
  return <Component {...props} />
}
