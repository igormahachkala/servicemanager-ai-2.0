import { Link, useParams } from 'react-router-dom'
import {
  SprintBacklog,
  SprintBoard,
  SprintBurndown,
  SprintCapacity,
  SprintGoal,
  SprintProgress,
  SprintReview,
} from '../components/sprint'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import { AI_PHOTO_LAB_SPRINT_1_ID } from '../domain/sprint/sprintStorage'
import { useSprint } from '../hooks/useSprint'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function SprintPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { selected, listStats } = useSprint(id ?? AI_PHOTO_LAB_SPRINT_1_ID)

  if (!selected) {
    return (
      <>
        <PageHeader title={t.sprintEngine.notFoundTitle} description={t.sprintEngine.notFoundDescription} />
        <Link to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`} className="mcBtn mcBtnSecondary">
          {t.sprintEngine.openProject}
        </Link>
      </>
    )
  }

  return (
    <div className="mcSprintPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.sprintEngine.title} description={t.sprintEngine.pageDescription} />
        <div className="mcSprintHeaderActions">
          <Link
            to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}/control-room`}
            className="mcBtn mcBtnSecondary"
          >
            {t.sprintEngine.openControlRoom}
          </Link>
          <Link to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`} className="mcBtn mcBtnSecondary">
            {t.sprintEngine.openProject}
          </Link>
          <Link to={`/ops/execution?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`} className="mcBtn mcBtnSecondary">
            {t.sprintEngine.openExecution}
          </Link>
          <Link to="/ops/runtime" className="mcBtn mcBtnSecondary">
            {t.sprintEngine.openRuntime}
          </Link>
        </div>
      </div>

      <div className="mcSprintTopStats">
        <span>{listStats.planned} {t.sprintEngine.plannedSprints}</span>
        <span>{selected.stats.commitmentPoints} SP {t.sprintEngine.committed}</span>
        <span>{selected.tasks.length} {t.sprintEngine.tasks}</span>
      </div>

      <div className="mcSprintGrid">
        <div className="mcSprintMain">
          <SprintGoal snapshot={selected} />
          <SprintProgress snapshot={selected} />
          <SprintBoard snapshot={selected} />
          <SprintBacklog snapshot={selected} />
          <SprintBurndown snapshot={selected} />
        </div>
        <div className="mcSprintSide">
          <SprintCapacity snapshot={selected} />
          <SprintReview snapshot={selected} />
          <Panel title={t.sprintEngine.sections.links}>
            <div className="mcProfilePanelBody mcSprintLinks">
              <Link to="/ops/reports">{t.pages.reports}</Link>
              <Link to="/ops/timeline">{t.pages.companyTimeline}</Link>
              <Link to={`/ops/collaboration?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}>
                {t.pages.collaboration}
              </Link>
              <Link to="/ops/handoffs">{t.pages.handoffs}</Link>
            </div>
          </Panel>
        </div>
      </div>

      <p className="mcSprintLocalNote">{t.sprintEngine.localNote}</p>
    </div>
  )
}
