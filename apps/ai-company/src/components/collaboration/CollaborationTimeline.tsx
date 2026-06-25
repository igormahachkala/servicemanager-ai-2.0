import type { CollaborationSession } from '../../domain/collaboration/collaborationSession'
import { COLLABORATION_STATUSES, statusProgressIndex } from '../../domain/collaboration/collaborationSession'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  session: CollaborationSession
}

export function CollaborationTimeline({ session }: Props) {
  const { t } = useI18n()
  const currentIndex = statusProgressIndex(session.status)

  return (
    <Panel title={t.collaborationEngine.sections.timeline}>
      <div className="mcProfilePanelBody">
        <div className="mcCollabTimeline">
          {COLLABORATION_STATUSES.map((status, index) => {
            const active = index <= currentIndex
            const current = status === session.status
            return (
              <div
                key={status}
                className={
                  current
                    ? 'mcCollabTimelineStep mcCollabTimelineStepCurrent'
                    : active
                      ? 'mcCollabTimelineStep mcCollabTimelineStepDone'
                      : 'mcCollabTimelineStep'
                }
              >
                <span className="mcCollabTimelineDot" />
                <span className="mcCollabTimelineLabel">{t.collaborationEngine.status[status]}</span>
              </div>
            )
          })}
        </div>
        <p className="mcCollabObserverNote">{session.observerNote ?? t.collaborationEngine.observerNote}</p>
      </div>
    </Panel>
  )
}
