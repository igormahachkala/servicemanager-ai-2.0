import { Panel } from '../../mission-control/components/ui'
import type { Reputation } from '../../domain/competencies/reputation'
import { useI18n } from '../../i18n'

export function ReputationCard(props: { reputation: Reputation | null }) {
  const { t } = useI18n()
  const reputation = props.reputation

  if (!reputation) return null

  const metrics = [
    { label: t.competencyEngine.reputation.accuracy, value: reputation.accuracy },
    { label: t.competencyEngine.reputation.reportsQuality, value: reputation.reportsQuality },
    { label: t.competencyEngine.reputation.trustScore, value: reputation.trustScore },
    { label: t.competencyEngine.reputation.successfulTasks, value: reputation.successfulTasks },
    { label: t.competencyEngine.reputation.reviews, value: reputation.reviews },
    { label: t.competencyEngine.reputation.productionApprovals, value: reputation.productionApprovals },
  ]

  return (
    <Panel title={t.competencyEngine.sections.reputation}>
      <div className="mcProfilePanelBody">
        <p className="mcCompetencyNote">{t.competencyEngine.reputation.calculatedBySystem}</p>
        <div className="mcCompetencyReputationGrid">
          {metrics.map((metric) => (
            <div key={metric.label} className="mcCompetencyReputationCell">
              <div className="mcCompetencyReputationLabel">{metric.label}</div>
              <div className="mcCompetencyReputationValue mcMono">{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="mcCompetencyTimelineMeta mcMono mcMuted">
          {t.competencyEngine.reputation.updated}{' '}
          {new Date(reputation.calculatedAt).toLocaleString()}
        </div>
      </div>
    </Panel>
  )
}
