import { Link } from 'react-router-dom'
import type { LearningRecommendation } from '../../domain/learning/learningRecommendation'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  items: LearningRecommendation[]
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
}

export function Recommendations({ items, onAccept, onDismiss }: Props) {
  const { t } = useI18n()
  const pending = items.filter((item) => !item.dismissed)

  return (
    <Panel
      title={t.learningEngine.sections.recommendations}
      right={
        <span className="mcMono mcMuted">
          {pending.length} {t.learningEngine.itemCount}
        </span>
      }
    >
      <div className="mcProfilePanelBody">
        {pending.length === 0 ? (
          <div className="mcLearningEmpty">{t.learningEngine.empty.recommendations}</div>
        ) : (
          <div className="mcLearningRecList">
            {pending.map((item) => (
              <div key={item.id} className="mcLearningRecCard">
                <div className="mcLearningRecHead">
                  <span className={`mcLearningPriority mcLearningPriority${item.priority}`}>
                    {t.learningEngine.priority[item.priority]}
                  </span>
                  <span className="mcLearningRecKind">{t.learningEngine.recommendationKinds[item.kind]}</span>
                  <span className="mcLearningRecSkill mcMono">{item.skillName}</span>
                </div>
                <div className="mcLearningRecTitle">{item.title}</div>
                <p className="mcLearningRecSummary">{item.summary}</p>
                <div className="mcLearningRecActions">
                  {item.href ? (
                    <Link to={item.href} className="mcBtn mcBtnSecondary mcBtnSmall">
                      {t.learningEngine.actions.open}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="mcBtn mcBtnPrimary mcBtnSmall"
                    onClick={() => onAccept(item.id)}
                  >
                    {t.learningEngine.actions.startLearning}
                  </button>
                  <button
                    type="button"
                    className="mcBtn mcBtnGhost mcBtnSmall"
                    onClick={() => onDismiss(item.id)}
                  >
                    {t.learningEngine.actions.dismiss}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
