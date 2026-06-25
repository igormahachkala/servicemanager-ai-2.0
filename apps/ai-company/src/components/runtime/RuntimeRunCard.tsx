import type { RuntimeRun } from '../../domain/runtime/runtimeOrchestrator'
import { getModelById, getProviderById } from '../../domain/runtime/runtimeStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'
import { RuntimeStateBadge } from './RuntimeStateBadge'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RuntimeRunCard({ run }: { run: RuntimeRun }) {
  const { t } = useI18n()
  const employee = resolveEmployee(run.employeeId)
  const model = getModelById(run.modelId)
  const provider = getProviderById(run.providerId)

  return (
    <article className="mcRuntimeRunCard">
      <div className="mcRuntimeRunCardHead">
        <div>
          <h3 className="mcRuntimeRunCardTitle">{run.id}</h3>
          <div className="mcRuntimeRunCardMeta mcMono mcMuted">
            {employee?.codename ?? run.employeeId}
          </div>
        </div>
        <RuntimeStateBadge state={run.status} />
      </div>
      <div className="mcRuntimeRunCardBody">
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.model}</span>
          <span className="mcMono">
            {model?.name ?? run.modelId} · {provider?.name ?? run.providerId}
          </span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.startedAt}</span>
          <span className="mcMono">{formatTime(run.startedAt)}</span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.finishedAt}</span>
          <span className="mcMono">{formatTime(run.finishedAt)}</span>
        </div>
        {run.reportId ? (
          <div className="mcRuntimeProfileRow">
            <span>{t.runtimeOrchestrator.report}</span>
            <span className="mcMono">{run.reportId}</span>
          </div>
        ) : null}
      </div>
    </article>
  )
}
