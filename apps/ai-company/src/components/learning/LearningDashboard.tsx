import type { LearningStats } from '../../domain/learning/learningStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  stats: LearningStats | null
  certificatesEarned: number
  employeeName: string
}

export function LearningDashboard({ stats, certificatesEarned, employeeName }: Props) {
  const { t } = useI18n()

  if (!stats) return null

  return (
    <Panel title={t.learningEngine.dashboard.title.replace('{name}', employeeName)}>
      <div className="mcProfilePanelBody">
        <p className="mcLearningLead">{t.learningEngine.dashboard.lead}</p>
        <div className="mcLearningOverviewGrid">
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.experience}</div>
            <div className="mcLearningMetricValue">{stats.totalExperience}</div>
          </div>
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.activeGoals}</div>
            <div className="mcLearningMetricValue">{stats.activeGoals}</div>
          </div>
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.completedSessions}</div>
            <div className="mcLearningMetricValue">{stats.completedSessions}</div>
          </div>
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.averageProgress}</div>
            <div className="mcLearningMetricValue">{stats.averageProgress}%</div>
          </div>
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.suggestions}</div>
            <div className="mcLearningMetricValue">{stats.pendingRecommendations}</div>
          </div>
          <div className="mcLearningMetric">
            <div className="mcLearningMetricLabel">{t.learningEngine.stats.certificates}</div>
            <div className="mcLearningMetricValue">{certificatesEarned}</div>
          </div>
        </div>
        <p className="mcLearningNote">{t.learningEngine.dashboard.notInModel}</p>
      </div>
    </Panel>
  )
}
