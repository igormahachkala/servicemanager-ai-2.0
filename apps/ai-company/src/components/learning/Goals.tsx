import type { LearningGoal } from '../../domain/learning/learningGoal'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  goals: LearningGoal[]
}

export function Goals({ goals }: Props) {
  const { t } = useI18n()
  const active = goals.filter((goal) => goal.status === 'active')

  return (
    <Panel title={t.learningEngine.sections.goals}>
      <div className="mcProfilePanelBody">
        {active.length === 0 ? (
          <div className="mcLearningEmpty">{t.learningEngine.empty.goals}</div>
        ) : (
          <div className="mcLearningGoalList">
            {active.map((goal) => (
              <div key={goal.id} className="mcLearningGoalCard">
                <div className="mcLearningGoalHead">
                  <span className="mcLearningGoalSkill">{goal.skillName}</span>
                  <span className="mcLearningGoalTarget mcMono">
                    {goal.currentPercent}% → {goal.targetPercent}%
                  </span>
                </div>
                <div className="mcLearningGoalBar">
                  <span
                    className="mcLearningGoalFill"
                    style={{ width: `${Math.min(100, goal.currentPercent)}%` }}
                  />
                  <span
                    className="mcLearningGoalTargetMark"
                    style={{ left: `${Math.min(100, goal.targetPercent)}%` }}
                    title={t.learningEngine.fields.target}
                  />
                </div>
                <div className="mcLearningGoalMeta mcMuted">
                  {t.learningEngine.fields.current}: {goal.currentPercent}% · {t.learningEngine.fields.target}:{' '}
                  {goal.targetPercent}%
                  {goal.dueDate ? ` · ${t.learningEngine.fields.due}: ${goal.dueDate.slice(0, 10)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
