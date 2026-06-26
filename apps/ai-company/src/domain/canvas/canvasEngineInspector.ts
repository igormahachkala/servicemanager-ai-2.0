import { loadEvents } from '../events/eventStorage'
import type {
  CanvasGraph,
  CanvasLiveEvent,
  CanvasLiveStatus,
  CanvasNode,
  CanvasNodeDetails,
  CanvasSummary,
} from './canvas'

const LIVE_EVENT_TEMPLATES: Array<{ tone: CanvasLiveEvent['tone']; message: string }> = [
  { tone: 'active', message: 'Atlas reviewing architecture path' },
  { tone: 'active', message: 'MAX executing delivery task' },
  { tone: 'waiting', message: 'Approval waiting for Owner decision' },
  { tone: 'info', message: 'Runtime orchestrator routing tool call' },
  { tone: 'active', message: 'QA validating acceptance scenario' },
  { tone: 'info', message: 'DevOps syncing deployment checklist' },
]

function nowIso(): string {
  return new Date().toISOString()
}

function isActiveStatus(status: CanvasLiveStatus | null): boolean {
  return status === 'working' || status === 'thinking' || status === 'running' || status === 'review'
}

export function buildInitialLiveEvents(graph: CanvasGraph): CanvasLiveEvent[] {
  const events: CanvasLiveEvent[] = []
  graph.nodes
    .filter((node) => isActiveStatus(node.liveStatus))
    .slice(0, 4)
    .forEach((node, index) => {
      events.push({
        id: `live-init-${node.id}`,
        at: nowIso(),
        message: `${node.label} · ${node.liveStatus ?? 'active'}`,
        nodeId: node.id,
        kind: node.kind,
        tone: node.liveStatus === 'waiting' ? 'waiting' : 'active',
      })
      if (index === 0) return
    })

  if (events.length === 0) {
    events.push({
      id: 'live-init-system',
      at: nowIso(),
      message: 'Company canvas ready — mock live stream',
      nodeId: null,
      kind: 'system',
      tone: 'info',
    })
  }

  return events.slice(0, 6)
}

export function tickLiveEvents(graph: CanvasGraph, pulse: number): CanvasLiveEvent[] {
  const template = LIVE_EVENT_TEMPLATES[pulse % LIVE_EVENT_TEMPLATES.length]
  const anchor =
    graph.nodes.find((node) => isActiveStatus(node.liveStatus)) ??
    graph.nodes.find((node) => node.kind === 'runtime') ??
    graph.nodes[0]

  const next: CanvasLiveEvent = {
    id: `live-${pulse}-${Date.now()}`,
    at: nowIso(),
    message: anchor ? `${anchor.label} — ${template.message}` : template.message,
    nodeId: anchor?.id ?? null,
    kind: anchor?.kind ?? 'system',
    tone: template.tone,
  }

  return [next, ...(graph.liveEvents ?? [])].slice(0, 8)
}

export function getCanvasSummary(graph: CanvasGraph): CanvasSummary {
  const activeEmployees = graph.nodes.filter(
    (node) => node.kind === 'employee' && isActiveStatus(node.liveStatus),
  )
  const runningTasks = graph.nodes.filter(
    (node) => node.kind === 'task' && (node.liveStatus === 'running' || node.liveStatus === 'thinking'),
  )
  const waitingApprovals = graph.nodes.filter(
    (node) =>
      (node.kind === 'approval' && node.liveStatus === 'waiting') ||
      (node.kind === 'task' && node.liveStatus === 'waiting'),
  )

  return {
    activeEmployees,
    runningTasks,
    waitingApprovals,
    recentEvents: graph.liveEvents.slice(0, 6),
    stats: {
      employees: graph.nodes.filter((node) => node.kind === 'employee').length,
      tasks: graph.nodes.filter((node) => node.kind === 'task').length,
      approvals: graph.nodes.filter((node) => node.kind === 'approval').length,
      runs: graph.nodes.filter((node) => node.kind === 'run').length,
      connections: graph.connections.length,
    },
  }
}

function relatedNodesFor(graph: CanvasGraph, nodeId: string): CanvasNode[] {
  const relatedIds = new Set<string>()
  graph.connections.forEach((connection) => {
    if (connection.fromId === nodeId) relatedIds.add(connection.toId)
    if (connection.toId === nodeId) relatedIds.add(connection.fromId)
  })
  return graph.nodes.filter((node) => relatedIds.has(node.id))
}

function recentEventsForNode(graph: CanvasGraph, node: CanvasNode): CanvasLiveEvent[] {
  const fromLive = graph.liveEvents.filter((event) => event.nodeId === node.id)
  if (fromLive.length > 0) return fromLive.slice(0, 4)

  const timeline = loadEvents()
    .filter(
      (event) =>
        event.employeeId === node.entityId ||
        event.sourceId === node.entityId ||
        event.type.toLowerCase().includes(node.label.toLowerCase().split(' ')[0]),
    )
    .slice(0, 3)

  return timeline.map((event) => ({
    id: `evt-${event.id}`,
    at: event.createdAt,
    message: event.type.replaceAll('.', ' · '),
    nodeId: node.id,
    kind: node.kind,
    tone: event.severity === 'warn' || event.severity === 'error' ? 'waiting' : 'info',
  }))
}

export function getCanvasNodeDetails(
  graph: CanvasGraph,
  nodeId: string | null,
): CanvasNodeDetails | null {
  if (!nodeId) return null
  const node = graph.nodes.find((item) => item.id === nodeId)
  if (!node) return null

  return {
    node,
    inbound: graph.connections.filter((item) => item.toId === nodeId),
    outbound: graph.connections.filter((item) => item.fromId === nodeId),
    relatedNodes: relatedNodesFor(graph, nodeId),
    recentEvents: recentEventsForNode(graph, node),
  }
}
