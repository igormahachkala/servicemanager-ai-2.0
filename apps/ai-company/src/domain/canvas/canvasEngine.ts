import { ensureSeedApprovals, loadApprovalStore } from '../approval/approvalStorage'
import { initializeCompanyEngine } from '../company/companyMigration'
import { loadExecutions } from '../execution/executionEngine'
import { taskTitle } from '../execution/executionEngine'
import { ensureSeedKnowledge, loadKnowledgeStore } from '../knowledge/knowledgeStorage'
import { loadOrganization } from '../organization/organizationStorage'
import { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID } from '../projects/aiPhotoLabIds'
import { getProjectById } from '../projects/project'
import { loadProjects } from '../projects/project'
import { loadReports } from '../reports/reportStorage'
import { loadPresenceRecords } from '../presence/presence'
import { getWorkspaceById } from '../workspaces/workspace'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { registryTools } from '../../mission-control/data/tools'
import type { ExecutionStatus } from '../execution/execution'
import {
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  DEFAULT_CANVAS_VIEWPORT,
  computeCanvasBounds,
  type CanvasConnection,
  type CanvasConnectionType,
  type CanvasGraph,
  type CanvasLiveStatus,
  type CanvasMode,
  type CanvasNode,
  type CanvasNodeKind,
  type CanvasViewportState,
} from './canvas'

const VIEWPORT_KEY = 'ai-company-canvas-viewport'
const LIVE_TICK_KEY = 'ai-company-canvas-live-tick'

const NODE_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  employee: { width: 128, height: 68 },
  project: { width: 148, height: 58 },
  workspace: { width: 132, height: 52 },
  task: { width: 136, height: 50 },
  runtime: { width: 112, height: 48 },
  run: { width: 118, height: 46 },
  report: { width: 118, height: 46 },
  approval: { width: 124, height: 46 },
  knowledge: { width: 112, height: 44 },
  tool: { width: 104, height: 42 },
}

let livePulse = 0

function nowIso(): string {
  return new Date().toISOString()
}

function liveFromExecution(status: ExecutionStatus): CanvasLiveStatus | null {
  if (status === 'queued') return 'waiting'
  if (status === 'preparing') return 'thinking'
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'running') return 'running'
  if (status === 'review') return 'review'
  if (status === 'completed') return 'completed'
  return null
}

function liveFromPresence(status: string): CanvasLiveStatus | null {
  if (status === 'working' || status === 'busy') return 'working'
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'reviewing') return 'review'
  if (status === 'in_discussion') return 'thinking'
  return status === 'available' ? 'working' : null
}

function createNode(input: {
  id: string
  kind: CanvasNodeKind
  entityId: string
  label: string
  subtitle?: string | null
  x: number
  y: number
  liveStatus?: CanvasLiveStatus | null
  href?: string | null
  modes?: CanvasMode[]
}): CanvasNode {
  const size = NODE_SIZE[input.kind]
  return {
    id: input.id,
    kind: input.kind,
    entityId: input.entityId,
    label: input.label,
    subtitle: input.subtitle ?? null,
    x: input.x,
    y: input.y,
    width: size.width,
    height: size.height,
    liveStatus: input.liveStatus ?? null,
    pulse: livePulse,
    href: input.href ?? null,
    modes: input.modes ?? ['company', 'live'],
  }
}

function connect(
  connections: CanvasConnection[],
  fromId: string,
  toId: string,
  type: CanvasConnectionType,
  label: string | null = null,
  animated = false,
): void {
  connections.push({
    id: `conn-${fromId}-${toId}-${type}`,
    fromId,
    toId,
    type,
    label,
    animated,
    pulsePhase: livePulse,
  })
}

function layoutCompanyGraph(nodes: CanvasNode[]): void {
  const cx = 520
  const cy = 340
  const project = nodes.find((item) => item.kind === 'project')
  if (project) {
    project.x = cx - project.width / 2
    project.y = cy - project.height / 2
  }
  const workspace = nodes.find((item) => item.kind === 'workspace')
  if (workspace) {
    workspace.x = cx - workspace.width / 2
    workspace.y = cy - 150
  }
  const runtime = nodes.find((item) => item.kind === 'runtime')
  if (runtime) {
    runtime.x = cx + 180
    runtime.y = cy - runtime.height / 2
  }

  const employees = nodes.filter((item) => item.kind === 'employee')
  employees.forEach((node, index) => {
    const angle = (index / Math.max(employees.length, 1)) * Math.PI * 2 - Math.PI / 2
    node.x = cx + Math.cos(angle) * 250 - node.width / 2
    node.y = cy + Math.sin(angle) * 190 - node.height / 2
  })

  const tasks = nodes.filter((item) => item.kind === 'task')
  tasks.forEach((node, index) => {
    node.x = 120 + (index % 4) * 160
    node.y = 520 + Math.floor(index / 4) * 72
  })

  const runs = nodes.filter((item) => item.kind === 'run')
  runs.forEach((node, index) => {
    node.x = 780 + (index % 3) * 130
    node.y = 180 + Math.floor(index / 3) * 70
  })

  const approvals = nodes.filter((item) => item.kind === 'approval')
  approvals.forEach((node, index) => {
    node.x = 760
    node.y = 420 + index * 64
  })

  const reports = nodes.filter((item) => item.kind === 'report')
  reports.forEach((node, index) => {
    node.x = 60
    node.y = 140 + index * 64
  })

  const knowledge = nodes.filter((item) => item.kind === 'knowledge')
  knowledge.forEach((node, index) => {
    node.x = 60
    node.y = 360 + index * 58
  })

  const tools = nodes.filter((item) => item.kind === 'tool')
  tools.forEach((node, index) => {
    node.x = 920
    node.y = 80 + index * 54
  })
}

function filterGraph(graph: CanvasGraph, mode: CanvasMode): CanvasGraph {
  let nodes = graph.nodes
  if (mode === 'live') {
    nodes = graph.nodes.filter(
      (node) => node.liveStatus !== null && node.liveStatus !== 'completed',
    )
  } else if (mode !== 'company') {
    nodes = graph.nodes.filter((node) => node.modes.includes(mode))
  }

  const nodeIds = new Set(nodes.map((item) => item.id))
  const connections = graph.connections.filter(
    (item) => nodeIds.has(item.fromId) && nodeIds.has(item.toId),
  )

  return {
    ...graph,
    mode,
    nodes,
    connections,
    bounds: computeCanvasBounds(nodes),
  }
}

export function buildCanvasGraph(mode: CanvasMode = 'company'): CanvasGraph {
  initializeCompanyEngine()
  ensureSeedKnowledge()

  const nodes: CanvasNode[] = []
  const connections: CanvasConnection[] = []
  const allModes: CanvasMode[] = ['company', 'project', 'runtime', 'knowledge', 'organization', 'live']

  const project = getProjectById(AI_PHOTO_LAB_PROJECT_ID) ?? loadProjects()[0]
  const workspace = getWorkspaceById(AI_PHOTO_LAB_WORKSPACE_ID)

  if (project) {
    nodes.push(
      createNode({
        id: `canvas-project-${project.id}`,
        kind: 'project',
        entityId: project.id,
        label: project.title,
        subtitle: project.status,
        x: 0,
        y: 0,
        href: `/ops/projects/${encodeURIComponent(project.id)}`,
        modes: allModes.filter((item) => item !== 'organization'),
      }),
    )
  }

  if (workspace) {
    nodes.push(
      createNode({
        id: `canvas-workspace-${workspace.id}`,
        kind: 'workspace',
        entityId: workspace.id,
        label: workspace.name,
        subtitle: workspace.type,
        x: 0,
        y: 0,
        href: `/ops/workspaces/${encodeURIComponent(workspace.id)}`,
        modes: ['company', 'project', 'live'],
      }),
    )
  }

  nodes.push(
    createNode({
      id: 'canvas-runtime-hub',
      kind: 'runtime',
      entityId: 'runtime-hub',
      label: 'Runtime',
      subtitle: 'orchestrator',
      x: 0,
      y: 0,
      liveStatus: 'running',
      href: '/ops/runtime',
      modes: ['company', 'runtime', 'live'],
    }),
  )

  const employees = loadCustomEmployees()
  const presenceByEmployee = new Map(loadPresenceRecords().map((item) => [item.employeeId, item]))

  employees.slice(0, 8).forEach((employee) => {
    const presence = presenceByEmployee.get(employee.id)
    const label = employee.codename ?? employee.name
    nodes.push(
      createNode({
        id: `canvas-employee-${employee.id}`,
        kind: 'employee',
        entityId: employee.id,
        label,
        subtitle: presence?.activity ?? employee.role,
        x: 0,
        y: 0,
        liveStatus: presence ? liveFromPresence(presence.status) : null,
        href: `/ops/employees/${encodeURIComponent(employee.id)}`,
        modes: allModes,
      }),
    )
  })

  const org = loadOrganization()
  org.reportingLines.slice(0, 6).forEach((line) => {
    const fromId = `canvas-employee-${line.managerId}`
    const toId = `canvas-employee-${line.employeeId}`
    if (nodes.some((item) => item.id === fromId) && nodes.some((item) => item.id === toId)) {
      connect(connections, fromId, toId, 'assignment', line.role, false)
    }
  })

  const executions = loadExecutions().slice(0, 10)
  executions.forEach((execution) => {
    nodes.push(
      createNode({
        id: `canvas-task-${execution.id}`,
        kind: 'task',
        entityId: execution.taskId,
        label: taskTitle(execution.taskId),
        subtitle: execution.status,
        x: 0,
        y: 0,
        liveStatus: liveFromExecution(execution.status),
        href: '/ops/execution',
        modes: ['company', 'project', 'runtime', 'live'],
      }),
    )

    const employeeNodeId = `canvas-employee-${execution.employeeId}`
    if (nodes.some((item) => item.id === employeeNodeId)) {
      connect(connections, employeeNodeId, `canvas-task-${execution.id}`, 'assignment', null, true)
    }
    if (project) {
      connect(connections, `canvas-project-${project.id}`, `canvas-task-${execution.id}`, 'execution')
    }

    if (execution.runtimeRunId) {
      nodes.push(
        createNode({
          id: `canvas-run-${execution.runtimeRunId}`,
          kind: 'run',
          entityId: execution.runtimeRunId,
          label: execution.runtimeRunId.replace('run-apl-', ''),
          subtitle: execution.status,
          x: 0,
          y: 0,
          liveStatus: liveFromExecution(execution.status),
          href: `/ops/runs/${encodeURIComponent(execution.runtimeRunId)}`,
          modes: ['company', 'project', 'runtime', 'live'],
        }),
      )
      connect(connections, `canvas-task-${execution.id}`, `canvas-run-${execution.runtimeRunId}`, 'runtime', null, true)
      connect(connections, 'canvas-runtime-hub', `canvas-run-${execution.runtimeRunId}`, 'runtime', null, true)
    }

    if (execution.status === 'waiting_approval' || execution.status === 'review') {
      connect(connections, `canvas-task-${execution.id}`, 'canvas-runtime-hub', 'approval', null, true)
    }
  })

  ensureSeedApprovals()
  loadApprovalStore()
    .approvals.filter((item) => item.status === 'pending')
    .slice(0, 4)
    .forEach((approval) => {
      nodes.push(
        createNode({
          id: `canvas-approval-${approval.id}`,
          kind: 'approval',
          entityId: approval.id,
          label: approval.title,
          subtitle: approval.priority,
          x: 0,
          y: 0,
          liveStatus: 'waiting',
          href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
          modes: ['company', 'project', 'live'],
        }),
      )
    })

  loadReports()
    .slice(0, 3)
    .forEach((report) => {
      nodes.push(
        createNode({
          id: `canvas-report-${report.id}`,
          kind: 'report',
          entityId: report.id,
          label: report.title,
          subtitle: report.status,
          x: 0,
          y: 0,
          liveStatus: report.status === 'draft' ? 'review' : 'completed',
          href: `/ops/reports/${encodeURIComponent(report.id)}`,
          modes: ['company', 'project', 'live'],
        }),
      )
    })

  loadKnowledgeStore().items
    .slice(0, 4)
    .forEach((item) => {
      nodes.push(
        createNode({
          id: `canvas-knowledge-${item.id}`,
          kind: 'knowledge',
          entityId: item.id,
          label: item.title,
          subtitle: item.type,
          x: 0,
          y: 0,
          href: `/ops/knowledge/${encodeURIComponent(item.id)}`,
          modes: ['company', 'knowledge', 'live'],
        }),
      )
    })

  registryTools
    .filter((item) => item.connectionStatus === 'connected')
    .slice(0, 4)
    .forEach((tool) => {
      nodes.push(
        createNode({
          id: `canvas-tool-${tool.id}`,
          kind: 'tool',
          entityId: tool.id,
          label: tool.name,
          subtitle: tool.provider,
          x: 0,
          y: 0,
          href: `/ops/tools/${encodeURIComponent(tool.id)}`,
          modes: ['company', 'runtime', 'live'],
        }),
      )
      connect(connections, 'canvas-runtime-hub', `canvas-tool-${tool.id}`, 'tool')
    })

  if (employees.length >= 2) {
    connect(connections, `canvas-employee-${employees[0].id}`, `canvas-employee-${employees[1].id}`, 'chat', null, true)
  }

  layoutCompanyGraph(nodes)

  const graph: CanvasGraph = {
    mode,
    nodes,
    connections,
    bounds: computeCanvasBounds(nodes),
    updatedAt: nowIso(),
  }

  return filterGraph(graph, mode)
}

export function tickCanvasLive(graph: CanvasGraph): CanvasGraph {
  livePulse = (livePulse + 1) % 360
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LIVE_TICK_KEY, String(livePulse))
    } catch {
      /* noop */
    }
  }

  const statuses: CanvasLiveStatus[] = ['working', 'thinking', 'running', 'waiting', 'review']
  const nodes = graph.nodes.map((node) => {
    if (!node.liveStatus || node.liveStatus === 'completed') {
      return { ...node, pulse: livePulse }
    }
    const flicker = livePulse % 7 === 0 ? statuses[livePulse % statuses.length] : node.liveStatus
    return { ...node, pulse: livePulse, liveStatus: flicker }
  })

  const connections = graph.connections.map((item) => ({
    ...item,
    pulsePhase: livePulse,
    animated: item.type === 'execution' || item.type === 'runtime' || item.type === 'chat' ? true : item.animated,
  }))

  return {
    ...graph,
    nodes,
    connections,
    updatedAt: nowIso(),
  }
}

export function loadCanvasViewport(): CanvasViewportState {
  if (typeof window === 'undefined') return DEFAULT_CANVAS_VIEWPORT
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY)
    if (!raw) return DEFAULT_CANVAS_VIEWPORT
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CANVAS_VIEWPORT
    const value = parsed as Record<string, unknown>
    return {
      panX: typeof value.panX === 'number' ? value.panX : DEFAULT_CANVAS_VIEWPORT.panX,
      panY: typeof value.panY === 'number' ? value.panY : DEFAULT_CANVAS_VIEWPORT.panY,
      zoom: typeof value.zoom === 'number'
        ? Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, value.zoom))
        : DEFAULT_CANVAS_VIEWPORT.zoom,
    }
  } catch {
    return DEFAULT_CANVAS_VIEWPORT
  }
}

export function saveCanvasViewport(viewport: CanvasViewportState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport))
  } catch {
    /* noop */
  }
}

export function getCanvasInspector(
  graph: CanvasGraph,
  nodeId: string | null,
): { node: CanvasNode; inbound: CanvasConnection[]; outbound: CanvasConnection[] } | null {
  if (!nodeId) return null
  const node = graph.nodes.find((item) => item.id === nodeId)
  if (!node) return null
  return {
    node,
    inbound: graph.connections.filter((item) => item.toId === nodeId),
    outbound: graph.connections.filter((item) => item.fromId === nodeId),
  }
}
