import type { RuntimeProfile } from '../../domain/runtime/runtimeStorage'
import { getModelById, getProviderForModel } from '../../domain/runtime/runtimeStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'
import { RuntimeStatusBadge } from './RuntimeStatusBadge'

export function RuntimeProfileCard({ profile }: { profile: RuntimeProfile }) {
  const { t } = useI18n()
  const employee = resolveEmployee(profile.employeeId)
  const primaryModel = getModelById(profile.primaryModelId)
  const primaryProvider = getProviderForModel(profile.primaryModelId)

  return (
    <article className="mcRuntimeProfileCard">
      <div className="mcRuntimeProfileHead">
        <div>
          <h3 className="mcRuntimeProfileTitle">
            {employee?.codename ?? profile.employeeId}
          </h3>
          <div className="mcRuntimeProfileMeta mcMono mcMuted">{profile.id}</div>
        </div>
        <RuntimeStatusBadge status={profile.status} />
      </div>

      <div className="mcRuntimeProfileBody">
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
          <span>{t.runtimeEngine.reasoningLevel}</span>
          <span>{t.runtimeEngine.reasoningLevels[profile.reasoningLevel]}</span>
        </div>
        <div className="mcRuntimeProfileRow">
          <span>{t.runtimeEngine.routingRules}</span>
          <span className="mcMono">{profile.routingRules.length}</span>
        </div>
      </div>
    </article>
  )
}
