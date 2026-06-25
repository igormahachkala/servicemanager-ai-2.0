import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ModelProviderCard } from '../components/runtime/ModelProviderCard'
import { RuntimeProfileCard } from '../components/runtime/RuntimeProfileCard'
import { RuntimeRunCard } from '../components/runtime/RuntimeRunCard'
import { useRuntime } from '../hooks/useRuntime'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import { useI18n } from '../i18n'

export function RuntimeSettingsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { profiles, providers, stats } = useRuntimeProfiles()
  const { runs, stats: runStats, startRun } = useRuntime()

  const handleDemoRun = () => {
    const profile = profiles[0]
    if (!profile) return
    const run = startRun({
      employeeId: profile.employeeId,
      workspaceId: null,
      taskType: 'conversation',
    })
    navigate(`/ops/runtime/runs/${run.id}`)
  }

  return (
    <>
      <PageHeader
        title={t.pages.runtimeSettings}
        description={t.runtimeOrchestrator.pageDescription}
      />

      <div className="mcPageHeaderRow" style={{ marginBottom: 16 }}>
        <p className="mcMuted">{t.runtimeEngine.pageDescription}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/ops/notifications?type=runtime" className="mcBtn mcBtnSecondary">
            {t.notificationEngine.runtimeInbox}
          </Link>
          <button type="button" className="mcBtn mcBtnPrimary" onClick={handleDemoRun}>
            {t.runtimeOrchestrator.startRun}
          </button>
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
