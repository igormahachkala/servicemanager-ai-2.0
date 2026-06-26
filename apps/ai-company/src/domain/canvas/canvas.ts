export const CANVAS_MODES = [
  'company',
  'project',
  'runtime',
  'knowledge',
  'organization',
  'live',
] as const

export type CanvasMode = (typeof CANVAS_MODES)[number]

export const CANVAS_NODE_KINDS = [
  'employee',
  'project',
  'workspace',
  'task',
  'runtime',
  'run',
  'report',
  'approval',
  'knowledge',
  'tool',
] as const

export type CanvasNodeKind = (typeof CANVAS_NODE_KINDS)[number]

export const CANVAS_CONNECTION_TYPES = [
  'assignment',
  'execution',
  'runtime',
  'report',
  'approval',
  'knowledge',
  'tool',
  'chat',
] as const

export type CanvasConnectionType = (typeof CANVAS_CONNECTION_TYPES)[number]

export const CANVAS_LIVE_STATUSES = [
  'working',
  'thinking',
  'waiting',
  'running',
  'review',
  'completed',
] as const

export type CanvasLiveStatus = (typeof CANVAS_LIVE_STATUSES)[number]

export const CANVAS_LAYERS = [
  'employees',
  'projects',
  'tasks',
  'runtime',
  'reports',
  'approvals',
  'knowledge',
  'tools',
  'chats',
] as const

export type CanvasLayerId = (typeof CANVAS_LAYERS)[number]

export type CanvasNode = {
  id: string
  kind: CanvasNodeKind
  entityId: string
  label: string
  subtitle: string | null
  meta: string | null
  x: number
  y: number
  width: number
  height: number
  liveStatus: CanvasLiveStatus | null
  pulse: number
  href: string | null
  modes: CanvasMode[]
}

export type CanvasConnection = {
  id: string
  fromId: string
  toId: string
  type: CanvasConnectionType
  label: string | null
  animated: boolean
  pulsePhase: number
}

export type CanvasLiveEvent = {
  id: string
  at: string
  message: string
  nodeId: string | null
  kind: CanvasNodeKind | 'system'
  tone: 'info' | 'active' | 'waiting'
}

export type CanvasViewportState = {
  panX: number
  panY: number
  zoom: number
}

export type CanvasBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export type CanvasGraph = {
  mode: CanvasMode
  focusProjectId: string | null
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  bounds: CanvasBounds
  liveEvents: CanvasLiveEvent[]
  updatedAt: string
}

export type CanvasInspectorModel = {
  node: CanvasNode
  inbound: CanvasConnection[]
  outbound: CanvasConnection[]
}

export type CanvasSummary = {
  activeEmployees: CanvasNode[]
  runningTasks: CanvasNode[]
  waitingApprovals: CanvasNode[]
  recentEvents: CanvasLiveEvent[]
  stats: {
    employees: number
    tasks: number
    approvals: number
    runs: number
    connections: number
  }
}

export type CanvasNodeDetails = CanvasInspectorModel & {
  relatedNodes: CanvasNode[]
  recentEvents: CanvasLiveEvent[]
}

export type BuildCanvasGraphInput = {
  mode?: CanvasMode
  projectId?: string | null
}

export const DEFAULT_CANVAS_LAYERS: Record<CanvasLayerId, boolean> = {
  employees: true,
  projects: true,
  tasks: true,
  runtime: true,
  reports: true,
  approvals: true,
  knowledge: true,
  tools: true,
  chats: true,
}

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewportState = {
  panX: 40,
  panY: 32,
  zoom: 1,
}

export const CANVAS_ZOOM_MIN = 0.45
export const CANVAS_ZOOM_MAX = 1.8

const LAYER_KINDS: Record<Exclude<CanvasLayerId, 'chats'>, CanvasNodeKind[]> = {
  employees: ['employee'],
  projects: ['project', 'workspace'],
  tasks: ['task'],
  runtime: ['runtime', 'run'],
  reports: ['report'],
  approvals: ['approval'],
  knowledge: ['knowledge'],
  tools: ['tool'],
}

export function nodeCenter(node: CanvasNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

export function nodePort(
  node: CanvasNode,
  target: { x: number; y: number },
): { x: number; y: number } {
  const center = nodeCenter(node)
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? node.x + node.width : node.x, y: center.y }
  }
  return { x: center.x, y: dy > 0 ? node.y + node.height : node.y }
}

export function computeCanvasBounds(nodes: CanvasNode[]): CanvasBounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 }
  }
  const minX = Math.min(...nodes.map((item) => item.x)) - 40
  const minY = Math.min(...nodes.map((item) => item.y)) - 40
  const maxX = Math.max(...nodes.map((item) => item.x + item.width)) + 40
  const maxY = Math.max(...nodes.map((item) => item.y + item.height)) + 40
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export function applyCanvasLayers(
  graph: CanvasGraph,
  layers: Record<CanvasLayerId, boolean>,
): CanvasGraph {
  const hiddenKinds = new Set<CanvasNodeKind>()
  ;(Object.keys(LAYER_KINDS) as Array<Exclude<CanvasLayerId, 'chats'>>).forEach((layer) => {
    if (!layers[layer]) {
      LAYER_KINDS[layer].forEach((kind) => hiddenKinds.add(kind))
    }
  })

  const nodes = graph.nodes.filter((node) => !hiddenKinds.has(node.kind))
  const nodeIds = new Set(nodes.map((item) => item.id))
  const connections = graph.connections.filter((item) => {
    if (!layers.chats && item.type === 'chat') return false
    return nodeIds.has(item.fromId) && nodeIds.has(item.toId)
  })

  return {
    ...graph,
    nodes,
    connections,
    bounds: computeCanvasBounds(nodes),
  }
}
