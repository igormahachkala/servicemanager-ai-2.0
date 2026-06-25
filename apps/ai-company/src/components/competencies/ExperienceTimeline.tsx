import { Panel } from '../../mission-control/components/ui'
import type { ExperienceEvent } from '../../domain/competencies/experienceEvent'
import { useI18n } from '../../i18n'

export function ExperienceTimeline(props: { events: ExperienceEvent[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t.competencyEngine.sections.experience}>
      {props.events.length === 0 ? (
        <div className="mcProfilePanelBody">
          <div className="mcCompetencyEmpty">{t.competencyEngine.empty.experience}</div>
        </div>
      ) : (
        <div className="mcCompetencyTimeline">
          {props.events.map((event) => (
            <article key={event.id} className="mcCompetencyTimelineItem">
              <div className="mcCompetencyTimelineHead">
                <span className="mcCompetencyTimelineType">{t.competencyEngine.experienceTypes[event.type]}</span>
                <span className="mcCompetencyTimelineTime mcMono mcMuted">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mcCompetencyTimelineDesc">{event.description}</p>
              <div className="mcCompetencyTimelineMeta mcMono mcMuted">
                {t.competencyEngine.fields.impact}: {t.competencyEngine.impact[event.impact]}
                {event.workspaceId ? ` · WS ${event.workspaceId}` : ''}
                {event.taskId ? ` · Task ${event.taskId}` : ''}
                {event.reportId ? ` · Report ${event.reportId}` : ''}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
