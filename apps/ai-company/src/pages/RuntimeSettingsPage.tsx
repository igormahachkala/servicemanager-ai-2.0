import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ModelProviderCard } from '../components/runtime/ModelProviderCard'
import { RuntimeProfileCard } from '../components/runtime/RuntimeProfileCard'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import { useI18n } from '../i18n'

export function RuntimeSettingsPage() {
  const { t } = useI18n()
  const { profiles, providers, stats } = useRuntimeProfiles()

  return (
    <>
      <PageHeader title={t.pages.runtimeSettings} description={t.runtimeEngine.pageDescription} />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.totalProfiles}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.activeProfiles}</div>
          <div className="mcMetricValue">{stats.active}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.providers}</div>
          <div className="mcMetricValue">{providers.length}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.stats.seedModels}</div>
          <div className="mcMetricValue">7</div>
        </div>
      </div>

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

      <p className="mcReportPrincipleNote">{t.runtimeEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeEngine.localOnly}</p>
    </>
  )
}
