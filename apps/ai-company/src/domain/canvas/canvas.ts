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

export type CanvasNode = {
  id: string
  kind: CanvasNodeKind
  entityId: string
  label: string
  subtitle: string | null
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
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  bounds: CanvasBounds
  updatedAt: string
}

export type CanvasInspectorModel = {
  node: CanvasNode
  inbound: CanvasConnection[]
  outbound: CanvasConnection[]
}

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewportState = {
  panX: 40,
  panY: 32,
  zoom: 1,
}

export const CANVAS_ZOOM_MIN = 0.45
export const CANVAS_ZOOM_MAX = 1.8

export function nodeCenter(node: CanvasNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
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
