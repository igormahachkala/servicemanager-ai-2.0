import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from './ui'
import { optionLabel, type CustomEmployee } from '../data/customEmployees'
import {
  calculateExperienceXp,
  formatRestrictionLabel,
  resolveEmployeeIdentity,
} from '../data/employeeIdentity'
import {
  getModelById,
  getProviderById,
  getProviderForModel,
} from '../../domain/runtime/runtimeStorage'
import { getActiveRuntimeProviderId } from '../../domain/runtime/providers/runtimeAdapter'
import { getAssignmentsForEmployee } from '../../domain/knowledge/knowledgeStorage'
import { buildCompetencyStats, getEmployeeCompetencySnapshot } from '../../domain/competencies/competencyStorage'
import { buildLearningStats, getEmployeeLearningSnapshot } from '../../domain/learning/learningStorage'
import { getMemoriesByEmployee } from '../../domain/memory/memory'
import { useRuntimeProfiles } from '../../hooks/useRuntimeProfiles'
import { useI18n } from '../../i18n'

type AuthorityKey =
  | 'write_code'
  | 'run_runtime'
  | 'create_handoff'
  | 'production'
  | 'git_push'
  | 'merge'
  | 'deployment'
  | 'cloud_execution'

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="mcPassportList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function AuthorityList({ keys, labels }: { keys: string[]; labels: Record<AuthorityKey, string> }) {
  return (
    <ul className="mcPassportAuthorityList">
      {keys.map((key) => (
        <li key={key}>
          <span className="mcPassportAuthorityMark" aria-hidden>
            ✔
          </span>
          {labels[key as AuthorityKey] ?? key}
        </li>
      ))}
    </ul>
  )
}

function SystemPromptBlock({ prompt }: { prompt: string }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <div className="mcPassportPrompt">
      <div className="mcPassportPromptActions">
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSm"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? t.employeeProfile.passport.hidePrompt : t.employeeProfile.passport.showPrompt}
        </button>
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={() => void handleCopy()}>
          {t.employeeProfile.passport.copyPrompt}
        </button>
        {copyStatus === 'copied' ? (
          <span className="mcMuted mcPassportCopyStatus">{t.employeeProfile.passport.copied}</span>
        ) : null}
        {copyStatus === 'error' ? (
          <span className="mcPassportCopyStatus mcPassportCopyError">{t.employeeProfile.passport.copyFailed}</span>
        ) : null}
      </div>
      {visible ? <pre className="mcProfileCodeBlock">{prompt}</pre> : null}
    </div>
  )
}

export function EmployeeIdentityPassport({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const { getProfile } = useRuntimeProfiles()
  const identity = useMemo(() => resolveEmployeeIdentity(employee), [employee])

  const runtimeProfile = getProfile(employee.id, employee.primaryModel)
  const primaryModel = getModelById(runtimeProfile.primaryModelId)
  const primaryProvider = getProviderForModel(runtimeProfile.primaryModelId)
  const activeProviderId = getActiveRuntimeProviderId()
  const activeProvider = getProviderById(activeProviderId)

  const competencySnapshot = getEmployeeCompetencySnapshot(employee.id)
  const competencyStats = buildCompetencyStats(competencySnapshot)
  const learningSnapshot = getEmployeeLearningSnapshot(employee.id)
  const learningStats = buildLearningStats(learningSnapshot)
  const knowledgeCount = getAssignmentsForEmployee(employee.id).length
  const memoryCount = getMemoriesByEmployee(employee.id).length
  const xp = calculateExperienceXp(
    learningStats.totalExperience,
    competencyStats.experienceCount,
    competencyStats.averageCompetency,
  )

  const authorityLabels = t.employeeProfile.passport.authorityItems
  const restrictionLabels = identity.restrictions.map((item) =>
    formatRestrictionLabel(item, t.employeeBuilder.options.restrictions),
  )

  const capabilityLabels = identity.capabilities.map((item) =>
    optionLabel(t.employeeBuilder.options.skills, item),
  )

  return (
    <div className="mcPassport">
      <Panel title={t.employeeProfile.passport.whoTitle}>
        <div className="mcProfilePanelBody mcPassportWho">
          <div className="mcPassportWhoRow">
            <span className="mcProfileFieldLabel">{t.employeeProfile.passport.name}</span>
            <strong>{employee.name}</strong>
            <span className="mcMono mcMuted">({employee.codename})</span>
          </div>
          <div className="mcPassportWhoRow">
            <span className="mcProfileFieldLabel">{t.employeeProfile.passport.role}</span>
            <span>{employee.role}</span>
          </div>
          <div className="mcPassportMission">{identity.mission}</div>
        </div>
      </Panel>

      <div className="mcProfileGrid">
        <Panel title={t.employeeProfile.passport.workTitle}>
          <div className="mcProfilePanelBody">
            <div className="mcPassportSubsection">
              <div className="mcProfileFieldLabel">{t.employeeProfile.passport.responsibilities}</div>
              <TagList items={identity.responsibilities} />
            </div>
            <div className="mcPassportSubsection">
              <div className="mcProfileFieldLabel">{t.employeeProfile.passport.capabilities}</div>
              <div className="mcTagRow">
                {capabilityLabels.map((item) => (
                  <span key={item} className="mcTag">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="mcPassportSubsection">
              <div className="mcProfileFieldLabel">{t.employeeProfile.passport.boundaries}</div>
              <TagList items={identity.boundaries} />
            </div>
          </div>
        </Panel>

        <Panel title={t.employeeProfile.passport.aiStackTitle}>
          <div className="mcProfilePanelBody mcStack">
            <div className="mcRuntimeProfileRow">
              <span>{t.employeeProfile.passport.primaryModel}</span>
              <span className="mcMono">{primaryModel?.name ?? runtimeProfile.primaryModelId}</span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.employeeProfile.passport.runtimeProvider}</span>
              <span className="mcMono">
                {primaryProvider?.name ?? '—'} · {t.employeeProfile.passport.active}:{' '}
                {activeProvider?.name ?? activeProviderId}
              </span>
            </div>
            <div className="mcRuntimeProfileRow">
              <span>{t.employeeProfile.passport.backupModels}</span>
              <span className="mcMono">
                {runtimeProfile.fallbackModelIds
                  .map((modelId) => getModelById(modelId)?.name ?? modelId)
                  .join(', ') || t.common.empty}
              </span>
            </div>
            <div className="mcPassportSubsection">
              <div className="mcProfileFieldLabel">{t.employeeProfile.passport.toolAccess}</div>
              <div className="mcTagRow">
                {employee.tools.map((tool) => (
                  <span key={tool} className="mcTag">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title={t.employeeProfile.passport.decisionTitle}>
        <div className="mcProfilePanelBody mcPassportDecisionGrid">
          <div>
            <div className="mcProfileFieldLabel">{t.employeeProfile.passport.autonomous}</div>
            <AuthorityList keys={identity.decisionAuthority.autonomous} labels={authorityLabels} />
          </div>
          <div>
            <div className="mcProfileFieldLabel">{t.employeeProfile.passport.ownerRequired}</div>
            <AuthorityList keys={identity.decisionAuthority.ownerRequired} labels={authorityLabels} />
          </div>
        </div>
      </Panel>

      <div className="mcProfileGrid">
        <Panel title={t.employeeBuilder.fields.systemPrompt}>
          <div className="mcProfilePanelBody">
            <SystemPromptBlock prompt={identity.systemPrompt} />
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.restrictions}>
          <div className="mcProfilePanelBody">
            <ul className="mcPassportList mcPassportRestrictions">
              {restrictionLabels.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel title={t.employeeProfile.passport.experienceTitle}>
        <div className="mcProfilePanelBody">
          <div className="mcPassportExperienceGrid">
            <div className="mcPassportExperienceTile">
              <div className="mcPassportExperienceLabel">{t.employeeProfile.passport.xp}</div>
              <div className="mcPassportExperienceValue mcMono">{xp}</div>
            </div>
            <div className="mcPassportExperienceTile">
              <div className="mcPassportExperienceLabel">{t.employeeProfile.passport.lessonsLearned}</div>
              <div className="mcPassportExperienceValue mcMono">{learningStats.completedSessions}</div>
            </div>
            <div className="mcPassportExperienceTile">
              <div className="mcPassportExperienceLabel">{t.employeeProfile.passport.knowledge}</div>
              <div className="mcPassportExperienceValue mcMono">{knowledgeCount}</div>
            </div>
            <div className="mcPassportExperienceTile">
              <div className="mcPassportExperienceLabel">{t.employeeProfile.passport.memory}</div>
              <div className="mcPassportExperienceValue mcMono">{memoryCount}</div>
            </div>
          </div>
          <div className="mcPassportExperienceLinks">
            <Link to={`/ops/employees/${employee.id}/learning`} className="mcBtn mcBtnSecondary mcBtnSm">
              {t.learningEngine.openLearning}
            </Link>
            <Link to={`/ops/employees/${employee.id}/memory`} className="mcBtn mcBtnSecondary mcBtnSm">
              {t.memoryEngine.openMemory}
            </Link>
            <Link to={`/ops/employees/${employee.id}/competencies`} className="mcBtn mcBtnSecondary mcBtnSm">
              {t.learningEngine.openCompetencies}
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  )
}
