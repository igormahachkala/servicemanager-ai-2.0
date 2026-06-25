import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { RuntimeArtifacts } from '../components/runtime/RuntimeArtifacts'
import { RuntimeContextCard } from '../components/runtime/RuntimeContextCard'
import { RuntimePipeline } from '../components/runtime/RuntimePipeline'
import { RuntimeRunCard } from '../components/runtime/RuntimeRunCard'
import { RuntimeStateBadge } from '../components/runtime/RuntimeStateBadge'
import { RuntimeWarnings } from '../components/runtime/RuntimeWarnings'
import { useRuntime } from '../hooks/useRuntime'
import { getModelById, getProviderById } from '../domain/runtime/runtimeStorage'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useI18n } from '../i18n'

export function RuntimeRunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { runs, getRun, approveRun } = useRuntime()

  const run = useMemo(() => (id ? getRun(id) : null), [id, runs, getRun])
  const employee = run ? resolveEmployee(run.employeeId) : null
  const model = run ? getModelById(run.modelId) : null
  const provider = run ? getProviderById(run.providerId) : null

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
    const updated = approveRun(run.id)
    if (updated) navigate(`/ops/runtime/runs/${updated.id}`)
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
            {model?.name ?? run.modelId}
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.provider}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {provider?.name ?? run.providerId}
          </div>
        </div>
      </div>

      {run.status === 'waiting_approval' ? (
        <div className="mcRuntimeApprovalBanner">
          <p>{t.runtimeOrchestrator.waitingApprovalNote}</p>
          <button type="button" className="mcBtn mcBtnPrimary" onClick={handleApprove}>
            {t.runtimeOrchestrator.grantApprovalMock}
          </button>
        </div>
      ) : null}

      <div className="mcGrid2">
        <Panel title={t.runtimeOrchestrator.runSummary}>
          <div className="mcProfilePanelBody">
            <RuntimeRunCard run={run} />
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

      <p className="mcReportPrincipleNote">{t.runtimeOrchestrator.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeOrchestrator.localOnly}</p>
    </>
  )
}
