import { useMemo } from 'react'
import type { SkillProgressPoint } from '../../domain/learning/learningStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  history: SkillProgressPoint[]
  skillName?: string
}

export function SkillGrowthChart({ history, skillName }: Props) {
  const { t } = useI18n()

  const points = useMemo(() => {
    const filtered = skillName
      ? history.filter((item) => item.skillName === skillName)
      : history
    return [...filtered]
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .slice(-12)
  }, [history, skillName])

  const skills = useMemo(
    () => [...new Set(points.map((item) => item.skillName))],
    [points],
  )

  if (points.length === 0) {
    return (
      <Panel title={t.learningEngine.sections.growthChart}>
        <div className="mcProfilePanelBody">
          <div className="mcLearningEmpty">{t.learningEngine.empty.growthChart}</div>
        </div>
      </Panel>
    )
  }

  const maxPercent = 100

  return (
    <Panel title={t.learningEngine.sections.growthChart}>
      <div className="mcProfilePanelBody">
        {skillName ? (
          <p className="mcLearningChartSkill mcMono">{skillName}</p>
        ) : (
          <p className="mcLearningChartSkill mcMuted">{skills.join(' · ')}</p>
        )}
        <div className="mcLearningChart" aria-hidden>
          <div className="mcLearningChartAxisY">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div className="mcLearningChartPlot">
            {points.map((point) => {
              const height = Math.max(4, Math.round((point.percent / maxPercent) * 100))
              return (
                <div key={`${point.skillName}-${point.recordedAt}`} className="mcLearningChartBarWrap">
                  <div
                    className="mcLearningChartBar"
                    style={{ height: `${height}%` }}
                    title={`${point.skillName} ${point.percent}%`}
                  />
                  <span className="mcLearningChartLabel">{point.recordedAt.slice(5, 10)}</span>
                </div>
              )
            })}
          </div>
        </div>
        <ul className="mcLearningChartLegend">
          {points.map((point) => (
            <li key={`legend-${point.recordedAt}-${point.skillName}`}>
              <span className="mcMono">{point.recordedAt.slice(0, 10)}</span> — {point.skillName}{' '}
              <strong>{point.percent}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
