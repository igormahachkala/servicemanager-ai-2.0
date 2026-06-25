import { Panel } from '../../mission-control/components/ui'
import type { CompetencyStats } from '../../domain/competencies/competencyStorage'
import type { Reputation } from '../../domain/competencies/reputation'
import { useI18n } from '../../i18n'

export function CompetencyOverview(props: {
  stats: CompetencyStats | null
  reputation: Reputation | null
}) {
  const { t } = useI18n()
  const { stats, reputation } = props

  if (!stats || !reputation) {
    return null
  }

  return (
    <Panel title={t.competencyEngine.overview.title}>
      <div className="mcProfilePanelBody">
        <p className="mcCompetencyLead">{t.competencyEngine.overview.lead}</p>
        <div className="mcCompetencyOverviewGrid">
          <div className="mcCompetencyMetric">
            <div className="mcCompetencyMetricLabel">{t.competencyEngine.stats.trustScore}</div>
            <div className="mcCompetencyMetricValue">{reputation.trustScore}</div>
          </div>
          <div className="mcCompetencyMetric">
            <div className="mcCompetencyMetricLabel">{t.competencyEngine.stats.averageCompetency}</div>
            <div className="mcCompetencyMetricValue">{stats.averageCompetency}</div>
          </div>
          <div className="mcCompetencyMetric">
            <div className="mcCompetencyMetricLabel">{t.competencyEngine.stats.skills}</div>
            <div className="mcCompetencyMetricValue">{stats.skillCount}</div>
          </div>
          <div className="mcCompetencyMetric">
            <div className="mcCompetencyMetricLabel">{t.competencyEngine.stats.experience}</div>
            <div className="mcCompetencyMetricValue">{stats.experienceCount}</div>
          </div>
        </div>
        <p className="mcCompetencyNote">{t.competencyEngine.overview.notInModel}</p>
      </div>
    </Panel>
  )
}
