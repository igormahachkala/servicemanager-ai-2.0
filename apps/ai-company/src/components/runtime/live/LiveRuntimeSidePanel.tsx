import { Link } from 'react-router-dom'
import { RuntimeContextCard } from '../RuntimeContextCard'
import { RuntimeModelRoutingPanel } from '../RuntimeModelRoutingPanel'
import { RuntimeStateBadge } from '../RuntimeStateBadge'
import type { RuntimeRun } from '../../../domain/runtime/runtimeOrchestrator'
import { getOrCreateRuntimeProfile } from '../../../domain/runtime/runtimeStorage'
import type { RunHistory } from '../../../domain/run/runStorage'
import { useI18n } from '../../../i18n'

type Props = {
  run: RuntimeRun | null
  runHistory: RunHistory | null
  employeeName: string | null
  modelName: string | null
  providerName: string | null
  reportStepDetail: string | null
  reportId: string | null
}

export function LiveRuntimeSidePanel({
  run,
  runHistory,
  employeeName,
  modelName,
  providerName,
  reportStepDetail,
  reportId,
}: Props) {
  const { t } = useI18n()

  if (!run) {
    return <p className="mcMuted">{t.runtimeLive.noRunSelected}</p>
  }

  const profile = getOrCreateRuntimeProfile(run.employeeId)

  return (
    <div className="mcLiveRuntimeSide">
      <div className="mcLiveRuntimeSideMeta">
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.state}</span>
          <RuntimeStateBadge state={run.status} />
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeLive.selectedEmployee}</span>
          <span className="mcMono">{employeeName ?? run.employeeId}</span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.model}</span>
          <span className="mcMono">{run.result?.catalogModelLabel ?? modelName ?? run.modelId}</span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeModelRouting.resolvedOllamaModel}</span>
          <span className="mcMono">
            {run.result?.resolvedOllamaTag ?? run.result?.ollamaModelTag ?? '—'}
          </span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeOrchestrator.provider}</span>
          <span className="mcMono">{providerName ?? run.providerId}</span>
        </div>
      </div>

      <div className="mcLiveRuntimeRoutingBlock">
        <span className="mcFieldLabel">{t.runtimeModelRouting.title}</span>
        <RuntimeModelRoutingPanel
          employeeId={run.employeeId}
          profile={profile}
          modelMode={run.result?.modelMode}
          result={run.result}
          compact
        />
      </div>

      <div className="mcLiveRuntimeIntegrations">
        <span className="mcFieldLabel">{t.runtimeLive.integrations}</span>
        <div className="mcLiveRuntimeIntegrationLinks">
          <Link to={`/ops/runtime/runs/${run.id}`} className="mcBtn mcBtnSecondary mcBtnSm">
            {t.runtimeOrchestrator.runPageTitle}
          </Link>
          {runHistory ? (
            <Link to={`/ops/runs/${runHistory.id}`} className="mcBtn mcBtnSecondary mcBtnSm">
              {t.runtimeLive.runHistory}
            </Link>
          ) : null}
          {reportId ? (
            <Link to={`/ops/reports/${reportId}`} className="mcBtn mcBtnSecondary mcBtnSm">
              {t.runtimeLive.reportLink}
            </Link>
          ) : null}
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary mcBtnSm">
            {t.pages.companyTimeline}
          </Link>
          <Link to={`/ops/employees/${run.employeeId}/workspace`} className="mcBtn mcBtnSecondary mcBtnSm">
            {t.runtimeLive.employeeWorkspace}
          </Link>
        </div>
      </div>

      <div className="mcLiveRuntimeReportStatus">
        <span className="mcFieldLabel">{t.runtimeLive.reportCreation}</span>
        <p className="mcMuted">
          {reportStepDetail ?? t.runtimeLive.reportPending}
        </p>
      </div>

      <div className="mcLiveRuntimeResultPreview">
        <span className="mcFieldLabel">{t.runtimeLive.resultPreview}</span>
        {run.result?.responseText ? (
          <pre className="mcRuntimeResponseText">{run.result.responseText}</pre>
        ) : (
          <p className="mcMuted">{t.runtimeLive.resultPending}</p>
        )}
      </div>

      <div className="mcLiveRuntimeContextBlock">
        <span className="mcFieldLabel">{t.runtimeOrchestrator.contextTitle}</span>
        <RuntimeContextCard context={run.context} />
      </div>
    </div>
  )
}
