import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LiveExecutionStream } from '../components/runtime/live/LiveExecutionStream'
import { LiveRuntimeBottomPanel } from '../components/runtime/live/LiveRuntimeBottomPanel'
import { LiveRuntimePipelinePanel } from '../components/runtime/live/LiveRuntimePipelinePanel'
import { LiveRuntimeSidePanel } from '../components/runtime/live/LiveRuntimeSidePanel'
import { RuntimeExecutionPanel } from '../components/runtime/RuntimeExecutionPanel'
import { RuntimeStateBadge } from '../components/runtime/RuntimeStateBadge'
import { useLiveRuntimeMonitor } from '../hooks/useLiveRuntimeMonitor'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import { agents } from '../mission-control/data/mock'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

const LIVE_EMPLOYEE_IDS = ['ag-cto', 'ag-max'] as const

export function RuntimeLivePage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const { getProfile } = useRuntimeProfiles()
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string>('ag-cto')

  useEffect(() => {
    const runId = searchParams.get('runId')
    if (runId) setSelectedRunId(runId)
  }, [searchParams])

  const monitor = useLiveRuntimeMonitor(selectedRunId)
  const profile = getProfile(employeeId)
  const employeeOptions = useMemo(
    () =>
      LIVE_EMPLOYEE_IDS.map((id) => {
        const agent = agents.find((item) => item.id === id)
        return { id, name: agent?.codename ?? id }
      }),
    [],
  )
  const employeeName =
    monitor.employee?.codename ??
    employeeOptions.find((item) => item.id === employeeId)?.name ??
    employeeId

  const providerStatus = monitor.activeHealth?.status ?? 'unknown'
  const reportDetail = monitor.reportStep
    ? `${monitor.reportStep.status}${monitor.reportStep.detail ? ` · ${monitor.reportStep.detail}` : ''}`
    : null

  return (
    <div className="mcLiveRuntimePage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.runtimeLive.title} description={t.runtimeLive.description} />
        <div className="mcLiveRuntimeHeaderActions">
          <Link to="/ops/runtime" className="mcBtn mcBtnSecondary">
            {t.runtimeOrchestrator.backToRuntime}
          </Link>
          <Link to="/ops/runs" className="mcBtn mcBtnSecondary">
            {t.pages.runs}
          </Link>
          <Link to="/ops/reports" className="mcBtn mcBtnSecondary">
            {t.pages.reports}
          </Link>
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
            {t.pages.companyTimeline}
          </Link>
          <Link to="/ops/notifications?type=runtime" className="mcBtn mcBtnSecondary">
            {t.notificationEngine.runtimeInbox}
          </Link>
          <Link to="/ops" className="mcBtn mcBtnSecondary">
            {t.commandCenter.title}
          </Link>
        </div>
      </div>

      <div className="mcLiveRuntimeStats">
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeLive.selectedEmployee}</span>
          <select
            className="mcSelect"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            {employeeOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeOrchestrator.model}</span>
          <span className="mcMono">{monitor.model?.name ?? profile.primaryModelId}</span>
        </div>
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeProviders.providerStatus}</span>
          <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${capitalize(providerStatus)}`}>
            {t.runtimeProviders.healthStatuses[providerStatus]}
          </span>
          <span className="mcMono mcMuted">{monitor.activeProvider?.name}</span>
        </div>
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeLive.elapsed}</span>
          <span className="mcMono">{monitor.elapsedLabel}</span>
        </div>
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeLive.timeout}</span>
          <span className="mcMono">{monitor.timeoutLabel}</span>
        </div>
        <div className="mcLiveRuntimeStat">
          <span className="mcLiveRuntimeStatLabel">{t.runtimeOrchestrator.state}</span>
          {monitor.monitoredRun ? (
            <RuntimeStateBadge state={monitor.monitoredRun.status} />
          ) : (
            <span className="mcMuted">{t.common.empty}</span>
          )}
        </div>
      </div>

      <Panel title={t.runtimeLive.launchTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeExecutionPanel
            employeeId={employeeId}
            employeeName={employeeName}
            defaultModelId={profile.primaryModelId}
            onRunStarted={(runId: string) => setSelectedRunId(runId)}
          />
        </div>
      </Panel>

      <div className="mcLiveRuntimeGrid">
        <div className="mcLiveRuntimePanelLeft">
          <Panel title={t.runtimeOrchestrator.pipelineTitle}>
            <div className="mcProfilePanelBody">
              {monitor.monitoredRun ? (
                <LiveRuntimePipelinePanel
                  steps={monitor.monitoredRun.pipeline}
                  currentStep={monitor.currentStep}
                />
              ) : (
                <p className="mcMuted">{t.runtimeLive.noRunSelected}</p>
              )}
            </div>
          </Panel>
        </div>

        <div className="mcLiveRuntimePanelCenter">
          <Panel title={t.runtimeLive.executionStream}>
            <div className="mcProfilePanelBody">
              <LiveExecutionStream
                entries={monitor.streamEntries}
                isLive={monitor.isLive}
                elapsedLabel={monitor.elapsedLabel}
                timeoutLabel={monitor.timeoutLabel}
              />
            </div>
          </Panel>
        </div>

        <div className="mcLiveRuntimePanelRight">
          <Panel title={t.runtimeLive.contextAndPreview}>
            <div className="mcProfilePanelBody">
              <LiveRuntimeSidePanel
                run={monitor.monitoredRun}
                runHistory={monitor.runHistory}
                employeeName={employeeName}
                modelName={monitor.model?.name ?? null}
                providerName={monitor.provider?.name ?? null}
                reportStepDetail={reportDetail}
                reportId={monitor.monitoredRun?.reportId ?? null}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel title={t.runtimeLive.bottomPanel}>
        <div className="mcProfilePanelBody">
          <LiveRuntimeBottomPanel
            runId={monitor.monitoredRun?.id ?? null}
            logs={monitor.logs}
            events={monitor.events}
            warnings={monitor.warnings}
          />
        </div>
      </Panel>

      {monitor.recentRuns.length > 0 ? (
        <Panel title={t.runtimeLive.recentRuns}>
          <div className="mcProfilePanelBody mcLiveRuntimeRecentRuns">
            {monitor.recentRuns.map((run) => (
              <button
                key={run.id}
                type="button"
                className={`mcLiveRuntimeRecentRun${selectedRunId === run.id ? ' mcLiveRuntimeRecentRunActive' : ''}`}
                onClick={() => setSelectedRunId(run.id)}
              >
                <span className="mcMono">{run.id}</span>
                <RuntimeStateBadge state={run.status} />
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <p className="mcReportPrincipleNote">{t.runtimeLive.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeLive.localOnly}</p>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
