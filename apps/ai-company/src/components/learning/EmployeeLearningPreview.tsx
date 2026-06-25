import { Link } from 'react-router-dom'
import { Goals } from './Goals'
import { Recommendations } from './Recommendations'
import { Panel } from '../../mission-control/components/ui'
import type { CustomEmployee } from '../../mission-control/data/customEmployees'
import { useLearning } from '../../hooks/useLearning'
import { useI18n } from '../../i18n'

export function EmployeeLearningPreview({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const { activeGoals, pendingRecommendations, stats, acceptRecommendation, dismissRecommendation } =
    useLearning(employee.id)

  return (
    <div className="mcStack">
      <Panel title={t.learningEngine.preview.title}>
        <div className="mcProfilePanelBody">
          <p className="mcLearningLead">{t.learningEngine.preview.lead}</p>
          <div className="mcLearningInlineStats mcMono mcMuted">
            {stats?.activeGoals ?? 0} {t.learningEngine.stats.activeGoals.toLowerCase()} ·{' '}
            {stats?.pendingRecommendations ?? 0} {t.learningEngine.stats.suggestions.toLowerCase()} ·{' '}
            {stats?.averageProgress ?? 0}% {t.learningEngine.stats.averageProgress.toLowerCase()}
          </div>
          <div className="mcFormActions">
            <Link
              to={`/ops/employees/${employee.id}/learning`}
              className="mcBtn mcBtnPrimary mcBtnSmall"
            >
              {t.learningEngine.openLearning}
            </Link>
            <Link
              to={`/ops/employees/${employee.id}/competencies`}
              className="mcBtn mcBtnSecondary mcBtnSmall"
            >
              {t.learningEngine.openCompetencies}
            </Link>
          </div>
        </div>
      </Panel>

      {activeGoals.length > 0 ? <Goals goals={activeGoals} /> : null}

      {pendingRecommendations.length > 0 ? (
        <Recommendations
          items={pendingRecommendations.slice(0, 2)}
          onAccept={acceptRecommendation}
          onDismiss={dismissRecommendation}
        />
      ) : null}
    </div>
  )
}
