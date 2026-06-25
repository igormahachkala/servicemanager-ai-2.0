import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

const HORIZONS = ['now', 'next', 'later'] as const

export function Roadmap({ project }: { project: Project }) {
  const { t } = useI18n()

  return (
    <Panel title={t.projects.roadmap.title}>
      <div className="acProjectRoadmapGrid">
        {HORIZONS.map((horizon) => {
          const items = project.roadmap.filter((item) => item.horizon === horizon)
          return (
            <div key={horizon} className="acProjectRoadmapColumn">
              <div className="acProjectRoadmapHead">{t.projects.roadmap.horizons[horizon]}</div>
              {items.length === 0 ? (
                <div className="acMuted">{t.projects.roadmap.empty}</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="acProjectRoadmapCard">
                    <div className="acProjectRoadmapTitle">{item.title}</div>
                    {item.description ? (
                      <div className="acMuted" style={{ fontSize: 12 }}>
                        {item.description}
                      </div>
                    ) : null}
                    {item.quarter ? (
                      <div className="acMono acMuted" style={{ fontSize: 11, marginTop: 6 }}>
                        {item.quarter}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
