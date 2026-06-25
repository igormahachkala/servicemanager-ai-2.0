import { Link } from 'react-router-dom'
import type { RunHistory } from '../../domain/run/runStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { getWorkspaceById } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'

function statusClass(status: RunHistory['status']): string {
  if (status === 'completed') return 'mcRunStatusCompleted'
  if (status === 'failed') return 'mcRunStatusFailed'
  if (status === 'waiting_approval') return 'mcRunStatusWaiting'
  if (status === 'running' || status === 'queued') return 'mcRunStatusRunning'
  return 'mcRunStatusCancelled'
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function RunCard({ run }: { run: RunHistory }) {
  const { t } = useI18n()
  const employee = resolveEmployee(run.employeeId)
  const workspace = run.workspaceId ? getWorkspaceById(run.workspaceId) : null

  return (
    <Link to={`/ops/runs/${run.id}`} className="mcRunCard mcRunCardLink">
      <div className="mcRunCardHeader">
        <h3 className="mcRunCardTitle">{employee?.codename ?? run.employeeId}</h3>
        <span className={`mcRunStatusBadge ${statusClass(run.status)}`}>
          {t.runEngine.statuses[run.status]}
        </span>
      </div>
      <div className="mcRunCardMeta mcMuted">
        <span className="mcMono">{run.id}</span>
        {run.modelId ? <span className="mcMono">{run.modelId}</span> : null}
      </div>
      <div className="mcRunCardStats">
        <span>{formatDuration(run.metrics.durationMs)}</span>
        <span>{run.metrics.estimatedTokens.toLocaleString()} tok</span>
        <span>${run.metrics.estimatedCost.toFixed(3)}</span>
      </div>
      <div className="mcRunCardFooter mcMuted">
        <span>{workspace?.name ?? t.runEngine.platformWide}</span>
        <span>{new Date(run.startedAt).toLocaleString()}</span>
      </div>
    </Link>
  )
}
