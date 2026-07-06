import { useMemo } from 'react'
import type { MaxOwnerCommandTemplateId } from '../../domain/maxWorkerLoop/maxOwnerCommandTemplates'
import {
  listMaxOwnerCommandTemplates,
  MAX_OWNER_COMMAND_TEMPLATE_IDS,
} from '../../domain/maxWorkerLoop/maxOwnerCommandTemplates'
import { resolveRuntimeModelRoute } from '../../domain/runtime/runtimeModelRouting'
import type { RuntimeProfile } from '../../domain/runtime/runtimeProfile'
import type { RuntimeModelMode } from '../../domain/runtime/runtimeModelRouting'
import { useI18n } from '../../i18n'

type Props = {
  profile: RuntimeProfile
  modelMode: RuntimeModelMode
  activeTemplateId: MaxOwnerCommandTemplateId | null
  onApplyTemplate: (templateId: MaxOwnerCommandTemplateId) => void
  onEnterMaxMode: () => void
  isMaxMode: boolean
}

const EXPLAIN_KEYS = [
  'whatMaxDoes',
  'model',
  'cursor',
  'ownerApproval',
  'memory',
  'knowledge',
] as const

type ExplainKey = (typeof EXPLAIN_KEYS)[number]

const TEMPLATE_I18N_KEYS: Record<MaxOwnerCommandTemplateId, 'runtimeRuI18n' | 'screenQa' | 'findMocks' | 'cursorHandoff' | 'reportNextStep'> = {
  'runtime-ru-i18n': 'runtimeRuI18n',
  'screen-qa': 'screenQa',
  'find-mocks': 'findMocks',
  'cursor-handoff': 'cursorHandoff',
  'report-next-step': 'reportNextStep',
}

export function MaxOwnerCommandPanel({
  profile,
  modelMode,
  activeTemplateId,
  onApplyTemplate,
  onEnterMaxMode,
  isMaxMode,
}: Props) {
  const { t } = useI18n()
  const copy = t.maxOwnerCommand

  const route = useMemo(
    () =>
      resolveRuntimeModelRoute({
        employeeId: profile.employeeId,
        profile,
        modelMode,
      }),
    [profile, modelMode],
  )

  const modelExplainBody = copy.explain.model.body
    .replace('{model}', route.resolvedOllamaTag)
    .replace('{catalog}', route.catalogModelLabel)
    .replace('{mode}', t.runtimeModelRouting.modes[route.modelMode])

  const explainBodies: Record<ExplainKey, string> = {
    whatMaxDoes: copy.explain.whatMaxDoes.body,
    model: modelExplainBody,
    cursor: copy.explain.cursor.body,
    ownerApproval: copy.explain.ownerApproval.body,
    memory: copy.explain.memory.body,
    knowledge: copy.explain.knowledge.body,
  }

  const templates = listMaxOwnerCommandTemplates()

  return (
    <section className="mcMaxOwnerCommand" aria-labelledby="max-owner-command-title">
      <div className="mcMaxOwnerCommandHeader">
        <div>
          <span className="mcMaxOwnerCommandBadge">{copy.modeBadge}</span>
          <h2 id="max-owner-command-title" className="mcMaxOwnerCommandTitle">
            {copy.modeTitle}
          </h2>
          <p className="mcMaxOwnerCommandLead">{copy.modeDescription}</p>
        </div>
        {!isMaxMode ? (
          <button type="button" className="mcBtn mcBtnPrimary" onClick={onEnterMaxMode}>
            {copy.enterMaxMode}
          </button>
        ) : null}
      </div>

      {isMaxMode ? (
        <>
          <div className="mcMaxOwnerCommandExplain">
            <h3 className="mcMaxOwnerCommandSectionTitle">{copy.explainTitle}</h3>
            <ul className="mcMaxOwnerCommandExplainGrid">
              {EXPLAIN_KEYS.map((key) => (
                <li key={key} className="mcMaxOwnerCommandExplainCard">
                  <span className="mcMaxOwnerCommandExplainLabel">{copy.explain[key].title}</span>
                  <p className="mcMaxOwnerCommandExplainBody">{explainBodies[key]}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mcMaxOwnerCommandTemplates">
            <h3 className="mcMaxOwnerCommandSectionTitle">{copy.templatesTitle}</h3>
            <p className="mcMuted mcMaxOwnerCommandTemplatesHint">{copy.templatesHint}</p>
            <div className="mcMaxOwnerCommandTemplateGrid">
              {templates.map((template) => {
                const i18nKey = TEMPLATE_I18N_KEYS[template.id]
                const templateCopy = copy.templates[i18nKey]
                const active = activeTemplateId === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`mcMaxOwnerCommandTemplateCard${active ? ' active' : ''}`}
                    onClick={() => onApplyTemplate(template.id)}
                  >
                    <span className="mcMaxOwnerCommandTemplateTitle">{templateCopy.title}</span>
                    <span className="mcMaxOwnerCommandTemplateSummary">{templateCopy.summary}</span>
                    <span className="mcMaxOwnerCommandTemplateHints">
                      {[
                        template.hints.cursorLikely ? copy.hints.cursor : null,
                        template.hints.ownerApprovalLikely ? copy.hints.ownerApproval : null,
                        template.hints.memoryLikely ? copy.hints.memory : null,
                        template.hints.knowledgeLikely ? copy.hints.knowledge : null,
                      ]
                        .filter(Boolean)
                        .map((hint) => (
                          <span key={hint} className="mcMaxOwnerCommandHintChip">
                            {hint}
                          </span>
                        ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="mcMuted mcMaxOwnerCommandAfterLaunch">{copy.afterLaunch}</p>
        </>
      ) : null}

      {!isMaxMode && MAX_OWNER_COMMAND_TEMPLATE_IDS.length > 0 ? (
        <p className="mcMuted">{copy.enterMaxModeHint}</p>
      ) : null}
    </section>
  )
}
