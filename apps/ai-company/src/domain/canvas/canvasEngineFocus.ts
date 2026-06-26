import { AI_PHOTO_LAB_PROJECT_ID } from '../projects/aiPhotoLabIds'
import type { CanvasConnection, CanvasNode } from './canvas'

export const PHOTO_LAB_FOCUS_EMPLOYEE_IDS = ['ag-cto', 'ag-max', 'ag-qa', 'ag-devops'] as const

export function shouldFocusProject(projectId: string | null | undefined): boolean {
  return Boolean(projectId)
}

export function filterGraphForProject(
  nodes: CanvasNode[],
  connections: CanvasConnection[],
  projectId: string,
): { nodes: CanvasNode[]; connections: CanvasConnection[] } {
  if (projectId !== AI_PHOTO_LAB_PROJECT_ID) {
    return { nodes, connections }
  }

  const keepNodeIds = new Set<string>([
    `canvas-project-${projectId}`,
    'canvas-runtime-hub',
  ])

  nodes.forEach((node) => {
    if (node.kind === 'workspace' && node.entityId.includes('photo-lab')) {
      keepNodeIds.add(node.id)
    }
    if (node.kind === 'employee' && PHOTO_LAB_FOCUS_EMPLOYEE_IDS.includes(node.entityId as typeof PHOTO_LAB_FOCUS_EMPLOYEE_IDS[number])) {
      keepNodeIds.add(node.id)
    }
    if (['task', 'run', 'report', 'approval', 'tool', 'knowledge'].includes(node.kind)) {
      keepNodeIds.add(node.id)
    }
  })

  const filteredNodes = nodes.filter((node) => keepNodeIds.has(node.id))
  const nodeIds = new Set(filteredNodes.map((item) => item.id))
  const filteredConnections = connections.filter(
    (item) => nodeIds.has(item.fromId) && nodeIds.has(item.toId),
  )

  return { nodes: filteredNodes, connections: filteredConnections }
}

export function layoutProjectFocusGraph(nodes: CanvasNode[]): void {
  const cx = 560
  const cy = 300
  const project = nodes.find((item) => item.kind === 'project')
  const workspace = nodes.find((item) => item.kind === 'workspace')
  const runtime = nodes.find((item) => item.kind === 'runtime')

  if (project) {
    project.x = cx - project.width / 2
    project.y = 80
  }
  if (workspace) {
    workspace.x = cx - workspace.width / 2
    workspace.y = 24
  }
  if (runtime) {
    runtime.x = cx + 220
    runtime.y = cy - runtime.height / 2
  }

  const employees = nodes.filter((item) => item.kind === 'employee')
  const employeeOrder = new Map<string, number>(
    PHOTO_LAB_FOCUS_EMPLOYEE_IDS.map((id, index) => [id, index]),
  )
  employees.sort(
    (a, b) => (employeeOrder.get(a.entityId) ?? 99) - (employeeOrder.get(b.entityId) ?? 99),
  )
  employees.forEach((node, index) => {
    const angle = Math.PI * 0.15 + (index / Math.max(employees.length - 1, 1)) * Math.PI * 0.7
    node.x = cx + Math.cos(angle) * 210 - node.width / 2
    node.y = cy + Math.sin(angle) * 150 - node.height / 2
  })

  const tasks = nodes.filter((item) => item.kind === 'task')
  tasks.forEach((node, index) => {
    node.x = 140 + (index % 3) * 170
    node.y = 520 + Math.floor(index / 3) * 78
  })

  const runs = nodes.filter((item) => item.kind === 'run')
  runs.forEach((node, index) => {
    node.x = 860 + (index % 2) * 130
    node.y = 160 + Math.floor(index / 2) * 72
  })

  const approvals = nodes.filter((item) => item.kind === 'approval')
  approvals.forEach((node, index) => {
    node.x = 860
    node.y = 380 + index * 68
  })

  const reports = nodes.filter((item) => item.kind === 'report')
  reports.forEach((node, index) => {
    node.x = 80
    node.y = 180 + index * 68
  })

  const tools = nodes.filter((item) => item.kind === 'tool')
  tools.forEach((node, index) => {
    node.x = 920
    node.y = 40 + index * 58
  })

  const knowledge = nodes.filter((item) => item.kind === 'knowledge')
  knowledge.forEach((node, index) => {
    node.x = 80
    node.y = 380 + index * 58
  })
}
