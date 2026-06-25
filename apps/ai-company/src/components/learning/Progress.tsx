import type { LearningStats } from '../../domain/learning/learningStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  stats: LearningStats | null
  skillProgress: Record<string, number>
}

export function Progress({ stats, skillProgress }: Props) {
  const { t } = useI18n()
  const skills = Object.entries(skillProgress).sort((a, b) => b[1] - a[1])

  return (
    <Panel title={t.learningEngine.sections.progress}>
      <div className="mcProfilePanelBody">
        {!stats ? (
          <div className="mcLearningEmpty">{t.learningEngine.empty.progress}</div>
        ) : (
          <>
            <div className="mcLearningProgressStats">
              <div className="mcLearningProgressStat">
                <span className="mcLearningProgressLabel">{t.learningEngine.stats.totalSessions}</span>
                <span className="mcLearningProgressValue">{stats.totalSessions}</span>
              </div>
              <div className="mcLearningProgressStat">
                <span className="mcLearningProgressLabel">{t.learningEngine.stats.skillsTracked}</span>
                <span className="mcLearningProgressValue">{stats.skillsTracked}</span>
              </div>
            </div>
            {skills.length === 0 ? (
              <div className="mcLearningEmpty">{t.learningEngine.empty.skills}</div>
            ) : (
              <div className="mcLearningSkillList">
                {skills.map(([name, percent]) => (
                  <div key={name} className="mcLearningSkillRow">
                    <span className="mcLearningSkillName">{name}</span>
                    <div className="mcCompetencyLevelBar">
                      <span
                        className="mcCompetencyLevelFill mcCompetencyLevelFillAccent"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="mcCompetencyLevelText mcMono">{percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
