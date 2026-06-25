import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { CertificationList } from '../components/competencies/CertificationList'
import { CompetencyOverview } from '../components/competencies/CompetencyOverview'
import { CompetencyStatsPanel } from '../components/competencies/CompetencyStats'
import { ExperienceTimeline } from '../components/competencies/ExperienceTimeline'
import { LearningPathCard } from '../components/competencies/LearningPathCard'
import { ReputationCard } from '../components/competencies/ReputationCard'
import { SkillMatrix } from '../components/competencies/SkillMatrix'
import { resolveEmployee } from '../mission-control/data/conversation'
import type { ExperienceEventType, ExperienceImpact } from '../domain/competencies/experienceEvent'
import { useCompetencies } from '../hooks/useCompetencies'
import { useExperience } from '../hooks/useExperience'
import { useReputation } from '../hooks/useReputation'
import { useI18n } from '../i18n'

const EVENT_TYPES: ExperienceEventType[] = ['task', 'report', 'workspace', 'training', 'review', 'certification']
const IMPACTS: ExperienceImpact[] = ['low', 'medium', 'high']

export function EmployeeCompetenciesPage() {
  const { id: employeeId } = useParams<{ id: string }>()
  const { t } = useI18n()
  const employee = useMemo(
    () => (employeeId ? resolveEmployee(employeeId) : null),
    [employeeId],
  )

  const { skills, competencies, certifications, learningPath, stats } = useCompetencies(employeeId)
  const { reputation } = useReputation(employeeId)
  const { events, add } = useExperience(employeeId)

  const [description, setDescription] = useState('')
  const [type, setType] = useState<ExperienceEventType>('task')
  const [impact, setImpact] = useState<ExperienceImpact>('medium')

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t.competencyEngine.notFoundTitle}
          description={t.competencyEngine.notFoundDescription}
        />
        <div className="mcCompetencyEmptyPage">
          <div className="mcCompetencyEmptyTitle">{t.competencyEngine.notFoundTitle}</div>
          <p className="mcCompetencyEmptyDesc">{t.competencyEngine.notFoundDescription}</p>
          <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
            {t.employeeProfile.backToEmployees}
          </Link>
        </div>
      </>
    )
  }

  const handleAddExperience = (event: FormEvent) => {
    event.preventDefault()
    if (!description.trim()) return
    add({ type, description: description.trim(), impact })
    setDescription('')
  }

  return (
    <div className="mcCompetencyPage">
      <div className="mcCompetencyPageHeader">
        <Link to={`/ops/employees/${employeeId}`} className="mcProfileBack">
          ← {t.competencyEngine.backToProfile}
        </Link>
        <PageHeader
          title={t.competencyEngine.pageTitle.replace('{name}', employee.codename)}
          description={t.competencyEngine.pageDescription}
        />
        <div className="mcPageHeaderRow" style={{ marginTop: 8 }}>
          <Link to={`/ops/employees/${employeeId}/learning`} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.learningEngine.openLearning}
          </Link>
        </div>
      </div>

      <CompetencyOverview stats={stats} reputation={reputation} />
      <CompetencyStatsPanel stats={stats} competencies={competencies} />

      <Panel title={t.competencyEngine.sections.competencies}>
        <div className="mcProfilePanelBody">
          {competencies.length === 0 ? (
            <div className="mcCompetencyEmpty">{t.competencyEngine.empty.competencies}</div>
          ) : (
            <div className="mcCompetencyDomainList">
              {competencies.map((item) => (
                <div key={item.domain} className="mcCompetencyDomainRow">
                  <span className="mcCompetencyDomainName">{item.domain}</span>
                  <div className="mcCompetencyLevelBar">
                    <span
                      className="mcCompetencyLevelFill mcCompetencyLevelFillAccent"
                      style={{ width: `${item.score}%` }}
                    />
                    <span className="mcCompetencyLevelText mcMono">{item.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <SkillMatrix skills={skills} />
      <ExperienceTimeline events={events} />
      <CertificationList certifications={certifications} />
      <ReputationCard reputation={reputation} />
      <LearningPathCard learningPath={learningPath} />

      <Panel title={t.competencyEngine.addExperienceTitle}>
        <form className="mcFormBody" onSubmit={handleAddExperience}>
          <div className="mcProfileFieldGrid">
            <label className="mcField">
              <span className="mcFieldLabel">{t.competencyEngine.fields.type}</span>
              <select
                className="mcInput"
                value={type}
                onChange={(event) => setType(event.target.value as ExperienceEventType)}
              >
                {EVENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {t.competencyEngine.experienceTypes[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mcField">
              <span className="mcFieldLabel">{t.competencyEngine.fields.impact}</span>
              <select
                className="mcInput"
                value={impact}
                onChange={(event) => setImpact(event.target.value as ExperienceImpact)}
              >
                {IMPACTS.map((item) => (
                  <option key={item} value={item}>
                    {t.competencyEngine.impact[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mcField" style={{ gridColumn: '1 / -1' }}>
              <span className="mcFieldLabel">{t.competencyEngine.fields.description}</span>
              <textarea
                className="mcTextarea"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.competencyEngine.addExperiencePlaceholder}
              />
            </label>
          </div>
          <div className="mcFormActions">
            <button type="submit" className="mcBtn mcBtnPrimary">
              {t.competencyEngine.addExperienceButton}
            </button>
          </div>
        </form>
      </Panel>

      <p className="mcCompetencyLocalNote">{t.competencyEngine.localOnly}</p>
    </div>
  )
}
