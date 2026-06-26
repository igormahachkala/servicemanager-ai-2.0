import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ModelRouteMatrix } from '../components/runtime/ModelRouteMatrix'
import { RuntimeExecutionPanel } from '../components/runtime/RuntimeExecutionPanel'
import { RuntimeFallbackList } from '../components/runtime/RuntimeFallbackList'
import { RuntimeHealth } from '../components/runtime/RuntimeHealth'
import { RuntimeLogs } from '../components/runtime/RuntimeLogs'
import { RuntimePolicyPanel } from '../components/runtime/RuntimePolicyPanel'
import { RuntimeStatusBadge } from '../components/runtime/RuntimeStatusBadge'
import { useModelRouter } from '../hooks/useModelRouter'
import {
  getModelById,
  getProviderById,
  getProviderForModel,
  TASK_TYPES,
  type TaskContext,
  type TaskType,
} from '../domain/runtime/runtimeStorage'
import { resolveEmployee } from '../mission-control/data/conversation'
import { loadCustomEmployees } from '../mission-control/data/customEmployees'
import { agents } from '../mission-control/data/mock'
import { useRuntimeProfiles } from '../hooks/useRuntimeProfiles'
import { useI18n } from '../i18n'

export function EmployeeRuntimePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { getProfile } = useRuntimeProfiles()
  const [taskType, setTaskType] = useState<TaskType>('conversation')
  const [hasSensitiveData, setHasSensitiveData] = useState(false)
  const [requiresExternalTools, setRequiresExternalTools] = useState(false)

  const employeeRef = id ? resolveEmployee(id) : null
  const customEmployee = useMemo(
    () => (id ? loadCustomEmployees().find((item) => item.id === id) ?? null : null),
    [id],
  )
  const builtinAgent = useMemo(() => agents.find((item) => item.id === id) ?? null, [id])
  const primaryModelLabel =
    customEmployee?.primaryModel ?? builtinAgent?.model ?? t.runtimeEngine.models.mockLocal

  const profile = id ? getProfile(id, primaryModelLabel) : null

  const taskContext: TaskContext = useMemo(
    () => ({
      taskType,
      hasSensitiveData,
      estimatedTokens: profile?.maxTokens ?? 4096,
      requiresTools: taskType === 'coding' || taskType === 'conversation',
      requiresCode: taskType === 'coding',
      requiresExternalTools,
    }),
    [taskType, hasSensitiveData, requiresExternalTools, profile?.maxTokens],
  )

  const { selection } = useModelRouter(profile, taskContext)

  if (!id || !employeeRef || !profile) {
    return (
      <>
        <PageHeader
          title={t.runtimeEngine.notFoundTitle}
          description={t.runtimeEngine.notFoundDescription}
        />
        <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
          {t.employeeProfile.backToEmployees}
        </Link>
      </>
    )
  }

  const primaryModel = getModelById(profile.primaryModelId)
  const primaryProvider = getProviderForModel(profile.primaryModelId)

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader
          title={t.runtimeEngine.employeePageTitle.replace('{name}', employeeRef.codename)}
          description={t.runtimeEngine.employeePageDescription}
        />
        <Link to={`/ops/employees/${id}`} className="mcBtn mcBtnSecondary">
          {t.employeeProfile.title}
        </Link>
        <Link to={`/ops/employees/${id}/learning`} className="mcBtn mcBtnSecondary">
          {t.learningEngine.openLearning}
        </Link>
      </div>

      <Panel title={t.runtimeProviders.executionTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeExecutionPanel
            employeeId={id}
            employeeName={employeeRef.codename}
            defaultModelId={profile.primaryModelId}
            taskType={taskType}
            onRunStarted={(runId) => navigate(`/ops/runtime/runs/${runId}`)}
          />
        </div>
      </Panel>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.runtimeStatus}</div>
          <div className="mcMetricValue">
            <RuntimeStatusBadge status={profile.status} />
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.primaryModel}</div>
          <div className="mcMetricValue" style={{ fontSize: 16 }}>
            {primaryModel?.name ?? profile.primaryModelId}
          </div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.routingRules}</div>
          <div className="mcMetricValue">{profile.routingRules.length}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.runtimeEngine.allowedProviders}</div>
          <div className="mcMetricValue">{profile.allowedProviderIds.length}</div>
        </div>
      </div>

      <div className="mcGrid2">
        <Panel title={t.runtimeEngine.profileSummary}>
          <div className="mcProfilePanelBody mcStack">
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
                  .map((modelId) => getModelById(modelId)?.name ?? modelId)
                  .join(', ') || t.common.empty}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.allowedProviders}</span>
              <span className="mcMono">
                {profile.allowedProviderIds
                  .map((providerId) => getProviderById(providerId)?.name ?? providerId)
                  .join(', ') || t.common.empty}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.reasoningLevel}</span>
              <span>{t.runtimeEngine.reasoningLevels[profile.reasoningLevel]}</span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.temperature}</span>
              <span className="mcMono">{profile.temperature}</span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.contextWindow}</span>
              <span className="mcMono">{profile.contextWindow}</span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.runtimeEngine.maxTokens}</span>
              <span className="mcMono">{profile.maxTokens}</span>
            </div>
          </div>
        </Panel>

        <Panel title={t.runtimeEngine.routerSimulator}>
          <div className="mcProfilePanelBody mcStack">
            <label className="mcField">
              <span className="mcFieldLabel">{t.runtimeEngine.taskType}</span>
              <select
                className="mcSelect"
                value={taskType}
                onChange={(event) => setTaskType(event.target.value as TaskType)}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t.runtimeEngine.taskTypes[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mcField mcFieldInline">
              <input
                type="checkbox"
                checked={hasSensitiveData}
                onChange={(event) => setHasSensitiveData(event.target.checked)}
              />
              <span>{t.runtimeEngine.hasSensitiveData}</span>
            </label>
            <label className="mcField mcFieldInline">
              <input
                type="checkbox"
                checked={requiresExternalTools}
                onChange={(event) => setRequiresExternalTools(event.target.checked)}
              />
              <span>{t.runtimeEngine.requiresExternalTools}</span>
            </label>
            <RuntimeFallbackList selection={selection} />
          </div>
        </Panel>
      </div>

      <Panel title={t.runtimeProviders.healthTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeHealth compact />
        </div>
      </Panel>

      <Panel title={t.runtimeProviders.logsTitle}>
        <div className="mcProfilePanelBody">
          <RuntimeLogs />
        </div>
      </Panel>

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

      <p className="mcReportPrincipleNote">{t.runtimeEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runtimeEngine.localOnly}</p>
    </>
  )
}
