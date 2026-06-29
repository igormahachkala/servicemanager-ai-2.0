import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { RuntimeArtifacts } from '../components/runtime/RuntimeArtifacts'
import { RuntimeContextCard } from '../components/runtime/RuntimeContextCard'
import { RuntimePipeline } from '../components/runtime/RuntimePipeline'
import { RuntimeRunCard } from '../components/runtime/RuntimeRunCard'
import { RuntimeStateBadge } from '../components/runtime/RuntimeStateBadge'
import { RuntimeLogs } from '../components/runtime/RuntimeLogs'
import { RuntimeWarnings } from '../components/runtime/RuntimeWarnings'
import { MemoryEvolutionPanel } from '../components/memory-evolution'
import { RuntimeModelRoutingPanel } from '../components/runtime/RuntimeModelRoutingPanel'
import { RuntimeRunMetricsRow } from '../components/runtime-monitor'
import { useRuntime } from '../hooks/useRuntime'
import { getRuntimeRunMetrics } from '../domain/runtimeMonitor'
import { getModelById, getOrCreateRuntimeProfile, getProviderById } from '../domain/runtime/runtimeStorage'
import { ToolExecutionLog } from '../components/toolExecution'
import { listToolExecutionsForRun } from '../domain/toolExecution'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useI18n } from '../i18n'

export function RuntimeRunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { runs, getRun, approveRun } = useRuntime()

  const run = useMemo(() => (id ? getRun(id) : null), [id, runs, getRun])
  const toolExecutions = useMemo(
    () => (run ? listToolExecutionsForRun(run.id) : []),
    [run],
  )
  const employee = run ? resolveEmployee(run.employeeId) : null
  const model = run ? getModelById(run.modelId) : null
  const provider = run ? getProviderById(run.providerId) : null
  const profile = run ? getOrCreateRuntimeProfile(run.employeeId) : null
  const runMetrics = run ? getRuntimeRunMetrics(run.id) : null

  if (!id || !run) {
    return (
      <>
        <PageHeader
          title={t.runtimeOrchestrator.notFoundTitle}
          description={t.runtimeOrchestrator.notFoundDescription}
        />
        <Link to="/ops/runtime" className="mcBtn mcBtnPrimary">
          {t.runtimeOrchestrator.backToRuntime}
        </Link>
      </>
    )
  }

  const handleApprove = () => {
    void approveRun(run.id).then((updated) => {
      if (updated) navigate(`/ops/runtime/runs/${updated.id}`)
    })
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.runtimeOrchestrator.runPageTitle} description={run.id} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/ops/runtime" className="mcBtn mcBtnSecondary">
            {t.runtimeOrchestrator.backToRuntime}
          </Link>
          <Link to={`/ops/employees/${run.employeeId}/runtime`} className="mcBtn mcBtnSecondary">
            {t.runtimeEngine.openRuntime}
          </Link>
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
            {t.pages.companyTimeline}
          </Link>
        </div>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.state}</div>
          <div className="mcMetricValue">
            <RuntimeStateBadge state={run.status} />
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.employee}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {employee?.codename ?? run.employeeId}
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.model}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {run.result?.catalogModelLabel ?? model?.name ?? run.modelId}
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeModelRouting.resolvedOllamaModel}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {run.result?.resolvedOllamaTag ?? run.result?.ollamaModelTag ?? '—'}
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.provider}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {provider?.name ?? run.providerId}
          </div>
        </div>
      </div>

      {runMetrics ? (
        <Panel title={t.runtimeMonitor.title}>
          <div className="mcProfilePanelBody">
            <RuntimeRunMetricsRow metrics={runMetrics} />
          </div>
        </Panel>
      ) : null}

      {run.status === 'waiting_approval' ? (
        <div className="mcRuntimeApprovalBanner">
          <p>{t.runtimeOrchestrator.waitingApprovalNote}</p>
          <button type="button" className="mcBtn mcBtnPrimary" onClick={handleApprove}>
            {t.runtimeOrchestrator.grantApprovalMock}
          </button>
        </div>
      ) : null}

      {run.status === 'completed' ? (
        <Panel title={t.memoryEvolution.runEvolutionTitle}>
          <div className="mcProfilePanelBody">
            <MemoryEvolutionPanel runId={run.id} employeeId={run.employeeId} />
            <p className="mcMuted" style={{ marginTop: 8, fontSize: 12 }}>
              {t.memoryEvolution.flowNote}
            </p>
          </div>
        </Panel>
      ) : null}

      <div className="mcGrid2">
        <Panel title={t.runtimeOrchestrator.runSummary}>
          <div className="mcProfilePanelBody">
            <RuntimeRunCard run={run} />
          </div>
        </Panel>

        <Panel title={t.runtimeModelRouting.title}>
          <div className="mcProfilePanelBody">
            {profile ? (
              <RuntimeModelRoutingPanel
                employeeId={run.employeeId}
                profile={profile}
                modelMode={run.result?.modelMode}
                result={run.result}
              />
            ) : null}
          </div>
        </Panel>

        <Panel title={t.runtimeOrchestrator.resultTitle}>
          <div className="mcProfilePanelBody mcStack">
            {run.result ? (
              <>
                <div className="mcRuntimeProfileRow">
                  <span>{t.runtimeOrchestrator.contextSize}</span>
                  <span className="mcMono">{run.result.contextSize}</span>
                </div>
                <div className="mcRuntimeProfileRow">
                  <span>{t.runtimeOrchestrator.knowledgeUsed}</span>
                  <span className="mcMono">{run.result.knowledgeUsed}</span>
                </div>
                <div className="mcRuntimeProfileRow">
                  <span>{t.runtimeOrchestrator.memoryUsed}</span>
                  <span className="mcMono">{run.result.memoryUsed}</span>
                </div>
                <div className="mcRuntimeProfileRow">
                  <span>{t.runtimeOrchestrator.estimatedTokens}</span>
                  <span className="mcMono">{run.result.estimatedTokens}</span>
                </div>
                <div className="mcRuntimeProfileRow">
                  <span>{t.runtimeOrchestrator.estimatedCost}</span>
                  <span className="mcMono">${run.result.estimatedCost.toFixed(4)}</span>
                </div>
                {run.result.executionDurationMs != null ? (
                  <div className="mcRuntimeProfileRow">
                    <span>{t.runtimeOrchestrator.executionDurationMs}</span>
                    <span className="mcMono">{run.result.executionDurationMs} ms</span>
                  </div>
                ) : null}
                {run.result.promptTokens != null ? (
                  <div className="mcRuntimeProfileRow">
                    <span>{t.runtimeOrchestrator.promptTokens}</span>
                    <span className="mcMono">{run.result.promptTokens}</span>
                  </div>
                ) : null}
                {run.result.completionTokens != null ? (
                  <div className="mcRuntimeProfileRow">
                    <span>{t.runtimeOrchestrator.completionTokens}</span>
                    <span className="mcMono">{run.result.completionTokens}</span>
                  </div>
                ) : null}
                {run.result.responseText ? (
                  <div className="mcRuntimeResponseBlock">
                    <span className="mcFieldLabel">{t.runtimeOrchestrator.responseText}</span>
                    <pre className="mcRuntimeResponseText">{run.result.responseText}</pre>
                  </div>
                ) : null}
                <RuntimeWarnings warnings={run.result.warnings} />
                <RuntimeArtifacts artifacts={run.result.artifacts} />
              </>
            ) : (
              <p className="mcMuted">{t.runtimeOrchestrator.noResultYet}</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title={t.runtimeOrchestrator.pipelineTitle}>
        <div className="mcProfilePanelBody">
          <RuntimePipeline steps={run.pipeline} />
        </div>
      </Panel>

      <Panel title={t.runtimeOrchestrator.contextTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeContextCard context={run.context} />
        </div>
      </Panel>

      <Panel title={t.runtimeProviders.logsTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeLogs runId={run.id} />
        </div>
      </Panel>

      <Panel title={t.pages.toolExecutions}>
        <ToolExecutionLog
          executions={toolExecutions}
          selectedId={null}
          onSelect={() => undefined}
        />
        <Link to="/ops/tool-executions" className="acLink" style={{ marginTop: 12, display: 'inline-block' }}>
          {t.pages.toolExecutions}
        </Link>
      </Panel>

      <p className="mcReportPrincipleNote">{t.runtimeOrchestrator.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeOrchestrator.localOnly}</p>
    </>
  )
}
