import type { CanvasNodeKind } from '../../domain/canvas'

const NODE_ICONS: Record<CanvasNodeKind, string> = {
  employee: '◎',
  project: '◈',
  workspace: '◧',
  task: '▤',
  runtime: '⎈',
  run: '▶',
  report: '📋',
  approval: '✓',
  knowledge: '📚',
  tool: '⚙',
}

export function canvasNodeIcon(kind: CanvasNodeKind): string {
  return NODE_ICONS[kind]
}

export function canvasNodeAccent(kind: CanvasNodeKind): string {
  switch (kind) {
    case 'employee':
      return '#38bdf8'
    case 'project':
      return '#818cf8'
    case 'workspace':
      return '#a78bfa'
    case 'task':
      return '#34d399'
    case 'runtime':
    case 'run':
      return '#c084fc'
    case 'approval':
      return '#fbbf24'
    case 'report':
      return '#fb923c'
    case 'knowledge':
      return '#22d3ee'
    case 'tool':
      return '#94a3b8'
    default:
      return '#818cf8'
  }
}
