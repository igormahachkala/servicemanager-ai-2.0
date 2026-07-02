import { Link, useNavigate } from 'react-router-dom'
import { PageGuideCard } from '../components/guided'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ModelProviderCard } from '../components/runtime/ModelProviderCard'
import { RuntimeExecutionPanel } from '../components/runtime/RuntimeExecutionPanel'
import { RuntimeHealth } from '../components/runtime/RuntimeHealth'
import { RuntimeLogs } from '../components/runtime/RuntimeLogs'
import { RuntimeProfileCard } from '../components/runtime/RuntimeProfileCard'
import { RuntimeRunCard } from '../components/runtime/RuntimeRunCard'
import { RuntimeCostDashboard } from '../components/runtime-monitor'
import { useRuntime } from '../hooks/useRuntime'
import { useRuntimeMonitor } from '../hooks/useRuntimeMonitor'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import { useI18n } from '../i18n'
import { EMPLOYEE_ROUTE_IDS } from '../mission-control/data/employeeIdResolver'

export function RuntimeSettingsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { profiles, providers, stats } = useRuntimeProfiles()
  const { runs, stats: runStats } = useRuntime()
  const { dashboard } = useRuntimeMonitor()
  const atlasProfile = profiles.find((item) => item.employeeId === 'ag-cto') ?? profiles[0]

  return (
    <>
      <PageHeader
        title={t.pages.runtimeSettings}
        description={t.runtimeOrchestrator.pageDescription}
      />

      <PageGuideCard pageId="runtime" />

      <div className="mcPageHeaderRow" style={{ marginBottom: 16 }}>
        <p className="mcMuted">{t.runtimeEngine.pageDescription}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/ops/runtime/live" className="mcBtn mcBtnPrimary">
            {t.pages.runtimeLive}
          </Link>
          <Link to="/ops/notifications?type=runtime" className="mcBtn mcBtnSecondary">
            {t.notificationEngine.runtimeInbox}
          </Link>
          <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
            {t.pages.handoffs}
          </Link>
          <Link to="/ops/tool-executions" className="mcBtn mcBtnSecondary">
            {t.pages.toolExecutions}
          </Link>
          <Link to={`/ops/employees/${EMPLOYEE_ROUTE_IDS.max}/learning`} className="mcBtn mcBtnSecondary">
            {t.learningEngine.teamLearning}
          </Link>
          <Link to="/ops/collaboration" className="mcBtn mcBtnSecondary">
            {t.pages.collaboration}
          </Link>
          <Link to="/ops/projects/project-ai-photo-lab/control-room" className="mcBtn mcBtnSecondary">
            {t.pages.controlRoom}
          </Link>
        </div>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.stats.totalRuns}</div>
          <div className="mcMetricValue">{runStats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeOrchestrator.stats.completed}</div>
          <div className="mcMetricValue">{runStats.completed}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.totalProfiles}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.providers}</div>
          <div className="mcMetricValue">{providers.length}</div>
        </div>
      </div>

      <Panel title={t.runtimeMonitor.title}>
        <div className="mcProfilePanelBody">
          <RuntimeCostDashboard dashboard={dashboard} recentLimit={6} />
        </div>
      </Panel>

      {atlasProfile ? (
        <Panel title={t.runtimeProviders.executionTitle}>
          <div className="mcProfilePanelBody">
            <RuntimeExecutionPanel
              employeeId={atlasProfile.employeeId}
              employeeName="Atlas"
              defaultModelId={atlasProfile.primaryModelId}
              onRunStarted={(runId) => navigate(`/ops/runtime/runs/${runId}`)}
            />
          </div>
        </Panel>
      ) : null}

      <Panel title={t.runtimeProviders.healthTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeHealth />
        </div>
      </Panel>

      <Panel title={t.runtimeProviders.logsTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeLogs />
        </div>
      </Panel>

      <Panel
        title={t.runtimeOrchestrator.runsCatalog}
        right={<span className="mcMono mcMuted">{runs.length}</span>}
      >
        <div className="mcProfilePanelBody mcStack">
          {runs.length === 0 ? (
            <p className="mcMuted">{t.runtimeOrchestrator.noResultYet}</p>
          ) : (
            <div className="mcRuntimeProfileGrid">
              {runs.slice(0, 6).map((run) => (
                <Link
                  key={run.id}
                  to={`/ops/runtime/runs/${run.id}`}
                  className="mcRuntimeProfileLink"
                >
                  <RuntimeRunCard run={run} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title={t.runtimeEngine.profilesCatalog}
        right={<span className="mcMono mcMuted">{profiles.length}</span>}
      >
        <div className="mcProfilePanelBody mcStack">
          {profiles.length === 0 ? (
            <p className="mcMuted">{t.runtimeEngine.emptyProfiles}</p>
          ) : (
            <div className="mcRuntimeProfileGrid">
              {profiles.map((profile) => (
                <Link
                  key={profile.id}
                  to={`/ops/employees/${profile.employeeId}/runtime`}
                  className="mcRuntimeProfileLink"
                >
                  <RuntimeProfileCard profile={profile} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title={t.runtimeEngine.providersCatalog}>
        <div className="mcProfilePanelBody mcRuntimeProviderGrid">
          {providers.map((provider) => (
            <ModelProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.runtimeOrchestrator.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeOrchestrator.localOnly}</p>
    </>
  )
}
