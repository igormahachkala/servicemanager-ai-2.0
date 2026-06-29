import { VISUAL_LAB_INTEGRATIONS, type VisualLabSessionContext, type VisualLabTimelineEntry } from '../../domain/visualLab'
import { Badge } from '../layout'
import { LivingPulseDot } from '../living'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'

type Props = {
  context: VisualLabSessionContext
  testSteps: Array<{ id: string; label: string; status: string }>
  currentTimelineEntry?: VisualLabTimelineEntry | null
}

export function VisualLabSidebar({ context, testSteps, currentTimelineEntry }: Props) {
  const { t } = useI18n()
  const vl = t.visualLab

  const passedCount = testSteps.filter((item) => item.status === 'passed').length
  const runningStep = testSteps.find((item) => item.status === 'running')

  return (
    <aside className="vlSidebar">
      <section className="vlSidebarSection">
        <div className="vlSidebarSectionTitle">{vl.sidebar.employee}</div>
        <Link to={`/ops/employees/${context.employeeId}`} className="vlSidebarPrimary">
          {context.employeeCodename}
        </Link>
        <div className="vlSidebarMeta">{context.employeeRole}</div>
        <div className="vlSidebarMeta acMono">{context.employeeId}</div>
      </section>

      {currentTimelineEntry || runningStep ? (
        <section className="vlSidebarSection">
          <div className="vlSidebarSectionTitle">{vl.sidebar.doingNow}</div>
          <div className="vlSidebarDoingNow">
            <LivingPulseDot phase="working" size="sm" />
            <span>{currentTimelineEntry?.label ?? runningStep?.label}</span>
          </div>
          {currentTimelineEntry?.detail ? (
            <div className="vlSidebarMeta">{currentTimelineEntry.detail}</div>
          ) : null}
        </section>
      ) : null}

      <section className="vlSidebarSection">
        <div className="vlSidebarSectionTitle">{vl.sidebar.task}</div>
        <div className="vlSidebarPrimary">{context.taskTitle}</div>
        <div className="vlSidebarMeta acMono">{context.taskId}</div>
        <Badge variant="warning">{context.taskPriority}</Badge>
      </section>

      <section className="vlSidebarSection">
        <div className="vlSidebarSectionTitle">{vl.sidebar.execution}</div>
        <div className="vlSidebarRow">
          <span>{vl.sidebar.status}</span>
          <Badge variant="default">{context.executionStatus}</Badge>
        </div>
        <div className="vlSidebarMeta acMono">{context.executionId}</div>
        <div className="vlSidebarRow">
          <span>{vl.sidebar.tests}</span>
          <span>
            {passedCount}/{testSteps.length}
          </span>
        </div>
      </section>

      <section className="vlSidebarSection">
        <div className="vlSidebarSectionTitle">{vl.sidebar.project}</div>
        <div className="vlSidebarPrimary">{context.projectTitle}</div>
      </section>

      <section className="vlSidebarSection">
        <div className="vlSidebarSectionTitle">{vl.sidebar.integrations}</div>
        <div className="vlIntegrationLinks">
          <Link to={VISUAL_LAB_INTEGRATIONS.execution}>{vl.integrations.execution}</Link>
          <Link to={VISUAL_LAB_INTEGRATIONS.runtime}>{vl.integrations.runtime}</Link>
          <Link to={VISUAL_LAB_INTEGRATIONS.handoffs}>{vl.integrations.handoffs}</Link>
          <Link to={VISUAL_LAB_INTEGRATIONS.reports}>{vl.integrations.reports}</Link>
          <Link to={VISUAL_LAB_INTEGRATIONS.canvas}>{vl.integrations.canvas}</Link>
          <Link to={VISUAL_LAB_INTEGRATIONS.controlRoom}>{vl.integrations.controlRoom}</Link>
        </div>
      </section>
    </aside>
  )
}
