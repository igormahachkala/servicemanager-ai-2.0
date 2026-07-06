import { Link } from 'react-router-dom'
import { buildMaxWorkerLoopPanelView } from '../../domain/maxWorkerLoop/maxWorkerLoopViewModel'
import type { MaxWorkerLoopSnapshot } from '../../domain/maxWorkerLoop'
import type { MaxWorkerLoopRecord } from '../../domain/maxWorkerLoop'
import { MaxWorkerLoopToolBranchPanel } from './MaxWorkerLoopToolBranchPanel'
import { useI18n } from '../../i18n'

type Props = {
  loop: MaxWorkerLoopRecord | null
  snapshot?: MaxWorkerLoopSnapshot | null
  compact?: boolean
  onApprovalDecision?: () => void
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusClass(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function MaxWorkerLoopPanel({ loop, snapshot = null, compact = false, onApprovalDecision }: Props) {
  const { t } = useI18n()

  if (!loop) {
    return (
      <div className={`acMaxLoopPanel acMaxLoopPanelEmpty${compact ? ' acMaxLoopPanelCompact' : ''}`}>
        <h3 className="acMaxLoopTitle">{t.maxWorkerLoop.title}</h3>
        <p className="acMaxLoopEmptyReason">{t.maxWorkerLoop.empty.reason}</p>
        <p className="acMaxLoopEmptyHint">{t.maxWorkerLoop.empty.actionHint}</p>
        <Link to="/ops/run-task?employee=ag-max" className="mcBtn mcBtnPrimary mcBtnSm">
          {t.maxWorkerLoop.empty.actionLabel}
        </Link>
        <p className="acMaxLoopEmptyExample">{t.maxWorkerLoop.empty.example}</p>
      </div>
    )
  }

  const view = buildMaxWorkerLoopPanelView(loop, snapshot)

  return (
    <div className={`acMaxLoopPanel${compact ? ' acMaxLoopPanelCompact' : ''}`}>
      <div className="acMaxLoopHead">
        <div>
          <h3 className="acMaxLoopTitle">{t.maxWorkerLoop.title}</h3>
          <p className="acMaxLoopSubtitle">{t.maxWorkerLoop.subtitle}</p>
        </div>
        <span className={`acMaxLoopStatus acMaxLoopStatus${statusClass(loop.status)}`}>
          {view.statusLabel}
        </span>
      </div>

      {view.errorMessage ? (
        <p className="acMaxLoopError">{view.errorMessage}</p>
      ) : null}

      <ol className="acMaxLoopSteps">
        {view.steps.map((step, index) => {
          const isCurrent = view.currentStepId === step.id
          return (
            <li
              key={step.id}
              className={`acMaxLoopStep acMaxLoopStep${statusClass(step.status)}${isCurrent ? ' acMaxLoopStepCurrent' : ''}`}
            >
              <div className="acMaxLoopStepHead">
                <span className="acMaxLoopStepOrder mcMono">{index + 1}</span>
                <div className="acMaxLoopStepTitleBlock">
                  <strong>{step.label}</strong>
                  <span className="acMaxLoopStepStatus">
                    {t.maxWorkerLoop.phaseStatus[step.status]}
                  </span>
                </div>
                <time className="acMaxLoopStepTime mcMono mcMuted" dateTime={step.completedAt ?? undefined}>
                  {formatTime(step.completedAt)}
                </time>
              </div>

              {step.description ? (
                <p className="acMaxLoopStepDescription">{step.description}</p>
              ) : null}

              {step.insight ? (
                <p className="acMaxLoopStepInsight">{step.insight}</p>
              ) : null}

              {!compact ? (
                <div className="acMaxLoopStepGuides">
                  <div className="acMaxLoopGuideBlock">
                    <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.whatHappens}</span>
                    <p>{step.whatHappens}</p>
                  </div>
                  <div className="acMaxLoopGuideBlock">
                    <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.whatNext}</span>
                    <p>{step.whatNext}</p>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      {snapshot?.cursorAutomation?.externalExecutorRequired && snapshot ? (
        <MaxWorkerLoopToolBranchPanel
          loopId={loop.id}
          snapshot={snapshot}
          compact={compact}
          onDecision={onApprovalDecision}
        />
      ) : null}

      {loop.runtimeRunId ? (
        <div className="acMaxLoopLinks">
          <Link to={`/ops/runtime/live?runId=${encodeURIComponent(loop.runtimeRunId)}`} className="acLink">
            {t.maxWorkerLoop.openLive}
          </Link>
          {loop.reportId ? (
            <Link to={`/ops/reports/${encodeURIComponent(loop.reportId)}`} className="acLink">
              {t.maxWorkerLoop.openReport}
            </Link>
          ) : null}
          <Link to={`/ops/runtime/runs/${encodeURIComponent(loop.runtimeRunId)}`} className="acLink">
            {t.maxWorkerLoop.openRun}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
