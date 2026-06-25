import { Link } from 'react-router-dom'
import type { LearningSession } from '../../domain/learning/learningSession'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  sessions: LearningSession[]
  onStart: (id: string) => void
  onComplete: (id: string) => void
}

export function LearningTimeline({ sessions, onStart, onComplete }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.learningEngine.sections.timeline}>
      <div className="mcProfilePanelBody">
        {sessions.length === 0 ? (
          <div className="mcLearningEmpty">{t.learningEngine.empty.sessions}</div>
        ) : (
          <div className="mcCompetencyTimeline">
            {sessions.map((session) => (
              <div key={session.id} className="mcCompetencyTimelineItem">
                <div className="mcCompetencyTimelineHead">
                  <span className="mcCompetencyTimelineType">
                    {t.learningEngine.sessionTypes[session.type]}
                  </span>
                  <span className="mcCompetencyTimelineTime mcMono">
                    {session.completedAt?.slice(0, 10) ?? session.createdAt.slice(0, 10)}
                  </span>
                </div>
                <div className="mcCompetencyTimelineDesc">{session.title}</div>
                <div className="mcCompetencyTimelineMeta mcMuted">
                  {session.skillName} · {session.progressPercent}% ·{' '}
                  {t.learningEngine.sessionStatus[session.status]}
                  {session.relatedProjectId
                    ? ` · ${t.learningEngine.meta.project}: ${session.relatedProjectId}`
                    : ''}
                </div>
                <div className="mcLearningRecActions" style={{ marginTop: 8 }}>
                  {session.status === 'planned' ? (
                    <button
                      type="button"
                      className="mcBtn mcBtnSecondary mcBtnSmall"
                      onClick={() => onStart(session.id)}
                    >
                      {t.learningEngine.actions.startSession}
                    </button>
                  ) : null}
                  {session.status === 'in_progress' ? (
                    <button
                      type="button"
                      className="mcBtn mcBtnPrimary mcBtnSmall"
                      onClick={() => onComplete(session.id)}
                    >
                      {t.learningEngine.actions.completeSession}
                    </button>
                  ) : null}
                  {session.relatedReportId ? (
                    <Link to={`/ops/reports/${session.relatedReportId}`} className="mcBtn mcBtnGhost mcBtnSmall">
                      {t.learningEngine.actions.viewReport}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
