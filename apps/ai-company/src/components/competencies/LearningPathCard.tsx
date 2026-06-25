import { Panel } from '../../mission-control/components/ui'
import type { LearningPath } from '../../domain/competencies/learningPath'
import { useI18n } from '../../i18n'

function SkillGroup(props: { title: string; items: string[]; empty: string }) {
  return (
    <div className="mcCompetencyLearningGroup">
      <div className="mcCompetencyLearningTitle">{props.title}</div>
      {props.items.length === 0 ? (
        <div className="mcMuted">{props.empty}</div>
      ) : (
        <div className="mcTagRow">
          {props.items.map((item) => (
            <span key={item} className="mcTag">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function LearningPathCard(props: { learningPath: LearningPath }) {
  const { t } = useI18n()

  return (
    <Panel title={t.competencyEngine.sections.learning}>
      <div className="mcProfilePanelBody mcStack">
        <SkillGroup
          title={t.competencyEngine.learning.completed}
          items={props.learningPath.completedSkills}
          empty={t.competencyEngine.empty.learningCompleted}
        />
        <SkillGroup
          title={t.competencyEngine.learning.planned}
          items={props.learningPath.plannedSkills}
          empty={t.competencyEngine.empty.learningPlanned}
        />
        <SkillGroup
          title={t.competencyEngine.learning.recommended}
          items={props.learningPath.recommendedSkills}
          empty={t.competencyEngine.empty.learningRecommended}
        />
      </div>
    </Panel>
  )
}
