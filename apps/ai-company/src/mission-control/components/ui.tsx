import type { AgentStatus, FeedSeverity, HealthStatus, TaskPriority, TaskStatus, ToolStatus } from '../data/types'

export function StatusDot({ kind }: { kind: 'green' | 'amber' | 'red' | 'gray' }) {
  return <span className={`mcDot mcDot${kind === 'green' ? 'Green' : kind === 'amber' ? 'Amber' : kind === 'red' ? 'Red' : 'Gray'}`} />
}

export function healthDot(status: HealthStatus) {
  if (status === 'up') return 'green' as const
  if (status === 'degraded') return 'amber' as const
  return 'red' as const
}

export function feedDot(severity: FeedSeverity) {
  if (severity === 'success' || severity === 'info') return 'green' as const
  if (severity === 'warn') return 'amber' as const
  return 'red' as const
}

export function agentStatusClass(status: AgentStatus): string {
  if (status === 'online') return 'mcStatusOnline'
  if (status === 'busy') return 'mcStatusBusy'
  if (status === 'idle') return 'mcStatusIdle'
  return 'mcStatusOffline'
}

export function priorityBadgeClass(p: TaskPriority): string {
  return `mcBadge mcBadge${p}`
}

export function taskStatusLabel(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    backlog: 'backlog',
    running: 'running',
    blocked: 'blocked',
    done: 'done',
  }
  return map[status]
}

export function toolStatusDot(status: ToolStatus) {
  if (status === 'healthy') return 'green' as const
  if (status === 'degraded') return 'amber' as const
  return 'red' as const
}

export function loadFillClass(pct: number): string {
  if (pct >= 85) return 'mcLoadFill mcLoadFillCrit'
  if (pct >= 65) return 'mcLoadFill mcLoadFillWarn'
  return 'mcLoadFill'
}

export function capFillClass(pct: number): string {
  if (pct >= 90) return 'mcCapFill mcCapFillCrit'
  if (pct >= 75) return 'mcCapFill mcCapFillWarn'
  return 'mcCapFill'
}

export function Panel(props: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mcPanel">
      <div className="mcPanelHeader">
        <span className="mcPanelTitle">{props.title}</span>
        {props.right}
      </div>
      <div className="mcPanelBody">{props.children}</div>
    </div>
  )
}

export function Metric(props: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="mcMetric">
      <div className="mcMetricLabel">{props.label}</div>
      <div className="mcMetricValue">{props.value}</div>
      {props.sub ? <div className="mcMetricSub">{props.sub}</div> : null}
    </div>
  )
}

export function PageHeader(props: { title: string; description: string }) {
  return (
    <header className="mcPageHeader">
      <h1 className="mcPageTitle">{props.title}</h1>
      <p className="mcPageDesc">{props.description}</p>
    </header>
  )
}

export function formatFeedTime(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().slice(11, 19)
}
