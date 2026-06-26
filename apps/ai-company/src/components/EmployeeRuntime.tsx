import { Link, useNavigate } from 'react-router-dom'
import type { CustomEmployee } from '../mission-control/data/customEmployees'
import { ModelRouteMatrix } from './runtime/ModelRouteMatrix'
import { RuntimeFallbackList } from './runtime/RuntimeFallbackList'
import { RuntimePolicyPanel } from './runtime/RuntimePolicyPanel'
import { RuntimeStatusBadge } from './runtime/RuntimeStatusBadge'
import { useModelRouter } from '../hooks/useModelRouter'
import { useRuntime } from '../hooks/useRuntime'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import {
  getModelById,
  getProviderById,
  getProviderForModel,
} from '../domain/runtime/runtimeStorage'
import { useI18n } from '../i18n'
import { Panel } from '../mission-control/components/ui'

export function EmployeeRuntime({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { getProfile } = useRuntimeProfiles()
  const { startRun } = useRuntime()
  const profile = getProfile(employee.id, employee.primaryModel)
  const previewContext = {
    taskType: 'conversation' as const,
    hasSensitiveData: false,
    estimatedTokens: profile.maxTokens,
    requiresTools: true,
  }
  const { selection } = useModelRouter(profile, previewContext)

  const handleStartRun = () => {
    void startRun({
      employeeId: employee.id,
      workspaceId: null,
      taskType: 'conversation',
      forceApproval: selection?.requiresApproval ?? false,
    }).then((run) => navigate(`/ops/runtime/runs/${run.id}`))
  }

  const primaryModel = getModelById(profile.primaryModelId)
  const primaryProvider = getProviderForModel(profile.primaryModelId)

  return (
    <div className="mcStack">
      <div className="mcPageHeaderRow">
        <div>
          <h2 className="mcSectionTitle">{t.runtimeEngine.employeeSectionTitle}</h2>
          <p className="mcMuted">{t.runtimeEngine.employeeSectionDescription}</p>
        </div>
        <Link to={`/ops/employees/${employee.id}/runtime`} className="mcBtn mcBtnSecondary">
          {t.runtimeEngine.openFullRuntime}
        </Link>
        <button type="button" className="mcBtn mcBtnPrimary" onClick={handleStartRun}>
          {t.runtimeOrchestrator.startRun}
        </button>
      </div>

      <div className="mcGrid2">
        <Panel title={t.runtimeEngine.profileSummary}>
          <div className="mcProfilePanelBody mcStack">
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.runtimeStatus}</span>
              <RuntimeStatusBadge status={profile.status} />
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.primaryModel}</span>
              <span className="mcMono">
                {primaryModel?.name ?? profile.primaryModelId}
                {primaryProvider ? ` · ${primaryProvider.name}` : ''}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.fallbackModels}</span>
              <span className="mcMono">
                {profile.fallbackModelIds
                  .map((id) => getModelById(id)?.name ?? id)
                  .join(', ') || t.common.empty}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.allowedProviders}</span>
              <span className="mcMono">
                {profile.allowedProviderIds
                  .map((id) => getProviderById(id)?.name ?? id)
                  .join(', ') || t.common.empty}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.temperature}</span>
              <span className="mcMono">{profile.temperature}</span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.contextWindow}</span>
              <span className="mcMono">{profile.contextWindow}</span>
            </div>
          </div>
        </Panel>

        <Panel title={t.runtimeEngine.routerPreview}>
          <div className="mcProfilePanelBody">
            <RuntimeFallbackList selection={selection} />
          </div>
        </Panel>
      </div>

      <Panel title={t.runtimeEngine.routingRules}>
        <div className="mcProfilePanelBody">
          <ModelRouteMatrix routes={profile.routingRules} />
        </div>
      </Panel>

      <Panel title={t.runtimeEngine.policiesTitle}>
        <div className="mcProfilePanelBody">
          <RuntimePolicyPanel
            privacyPolicy={profile.privacyPolicy}
            costPolicy={profile.costPolicy}
          />
        </div>
      </Panel>

      <Panel title={t.runtimeEngine.futureConnectorsTitle}>
        <div className="mcProfilePanelBody mcStack">
          <p className="mcMuted">{t.runtimeEngine.futureConnectorsDescription}</p>
          <div className="mcRuntimeFutureGrid">
            <div className="mcRuntimeFutureItem">
              <span className="mcRuntimeFutureBadge">{t.runtimeEngine.futureBadge}</span>
              Ollama
            </div>
            <div className="mcRuntimeFutureItem">
              <span className="mcRuntimeFutureBadge">{t.runtimeEngine.futureBadge}</span>
              OpenRouter
            </div>
            <div className="mcRuntimeFutureItem">
              <span className="mcRuntimeFutureBadge">{t.runtimeEngine.futureBadge}</span>
              Runtime Orchestrator
            </div>
          </div>
        </div>
      </Panel>

      <p className="mcMemoryLocalNote">{t.runtimeEngine.modelIndependenceNote}</p>
    </div>
  )
}
