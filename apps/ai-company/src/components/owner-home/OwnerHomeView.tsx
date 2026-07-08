import { Link } from 'react-router-dom'
import type {
  OwnerHomeCompanyStatus,
  OwnerHomeCompletedTask,
  OwnerHomeDecisionItem,
  OwnerHomeOperatingStatus,
} from '../../domain/ownerHome'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useOwnerHome } from '../../hooks/useOwnerHome'
import { useI18n } from '../../i18n'
import { PageHeader } from '../layout'

function formatTime(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge(props: { status: OwnerHomeOperatingStatus }) {
  const { t } = useI18n()
  const label = t.ownerHome.companyStatus.operatingStatus[props.status]
  return (
    <span className={`acOwnerHomeStatus acOwnerHomeStatus--${props.status}`}>{label}</span>
  )
}

function CompanyStatusPanel(props: { status: OwnerHomeCompanyStatus }) {
  const { t } = useI18n()
  const m = t.ownerHome.metrics
  const { status } = props

  return (
    <section className="acOwnerHomePanel">
      <div className="acOwnerHomePanelHead">
        <h2 className="acOwnerHomePanelTitle">{t.ownerHome.sections.companyStatus}</h2>
        <StatusBadge status={status.operatingStatus} />
      </div>
      <div className="acOwnerHomeMetrics">
        <MetricCard label={m.activeEmployees} value={String(status.activeEmployeesCount)} />
        <MetricCard label={m.tasksInProgress} value={String(status.tasksInProgress)} />
        <MetricCard label={m.tasksCompletedToday} value={String(status.tasksCompletedToday)} />
        <MetricCard label={m.pendingDecisions} value={String(status.pendingOwnerDecisions)} />
      </div>
      <p className="acMuted acOwnerHomePanelHint">
        {status.isOperating ? t.ownerHome.companyStatus.operatingHint : t.ownerHome.companyStatus.idleHint}
      </p>
    </section>
  )
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="acOwnerHomeMetric">
      <div className="acOwnerHomeMetricValue">{props.value}</div>
      <div className="acOwnerHomeMetricLabel">{props.label}</div>
    </div>
  )
}

function CompletedTasksPanel(props: { tasks: OwnerHomeCompletedTask[] }) {
  const { t } = useI18n()

  return (
    <section className="acOwnerHomePanel">
      <h2 className="acOwnerHomePanelTitle">{t.ownerHome.sections.completedTasks}</h2>
      {props.tasks.length === 0 ? (
        <p className="acMuted">{t.ownerHome.empty.completedTasks}</p>
      ) : (
        <ul className="acOwnerHomeList">
          {props.tasks.map((task) => (
            <li key={task.id} className="acOwnerHomeListItem">
              <div className="acOwnerHomeListMain">
                <div className="acOwnerHomeListTitle">{task.title}</div>
                <div className="acOwnerHomeListMeta">
                  <span>{task.employeeLabel}</span>
                  {formatTime(task.completedAt) ? (
                    <>
                      <span className="acOwnerHomeMetaSep">·</span>
                      <span>{formatTime(task.completedAt)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              {task.reportHref ? (
                <Link to={task.reportHref} className="mcBtn mcBtnSecondary mcBtnSm">
                  {task.reportTitle ?? t.ownerHome.actions.openReport}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function decisionKindLabel(kind: OwnerHomeDecisionItem['kind'], t: ReturnType<typeof useI18n>['t']): string {
  return t.ownerHome.decisionKinds[kind]
}

function DecisionsPanel(props: { items: OwnerHomeDecisionItem[] }) {
  const { t } = useI18n()

  return (
    <section className="acOwnerHomePanel">
      <h2 className="acOwnerHomePanelTitle">{t.ownerHome.sections.decisions}</h2>
      {props.items.length === 0 ? (
        <p className="acMuted">{t.ownerHome.empty.decisions}</p>
      ) : (
        <ul className="acOwnerHomeList">
          {props.items.map((item) => (
            <li key={item.id} className="acOwnerHomeListItem">
              <div className="acOwnerHomeListMain">
                <div className="acOwnerHomeListBadges">
                  <span className="acOwnerHomeBadge">{decisionKindLabel(item.kind, t)}</span>
                  {formatTime(item.at) ? (
                    <span className="acMuted acOwnerHomeListTime">{formatTime(item.at)}</span>
                  ) : null}
                </div>
                <div className="acOwnerHomeListTitle">{item.title}</div>
                {item.detail ? <p className="acMuted acOwnerHomeListDetail">{item.detail}</p> : null}
              </div>
              <Link to={item.href} className="mcBtn mcBtnSecondary mcBtnSm">
                {t.ownerHome.actions.review}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NextActionsPanel() {
  const { t } = useI18n()
  const maxId = encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)
  const actions = [
    {
      id: 'run-task',
      ...t.ownerHome.nextActions.runTask,
      href: `/ops/run-task?employee=${maxId}`,
      primary: true,
    },
    {
      id: 'morning-report',
      ...t.ownerHome.nextActions.morningReport,
      href: '/ops/morning-report',
      primary: true,
    },
    {
      id: 'max-today',
      ...t.ownerHome.nextActions.maxToday,
      href: `/ops/employees/${maxId}/today`,
      primary: false,
    },
    {
      id: 'max-queue',
      ...t.ownerHome.nextActions.maxQueue,
      href: `/ops/employees/${maxId}/workspace`,
      primary: false,
    },
  ]

  return (
    <section className="acOwnerHomePanel acOwnerHomePanelNext">
      <h2 className="acOwnerHomePanelTitle">{t.ownerHome.sections.nextActions}</h2>
      <div className="acOwnerHomeNextGrid">
        {actions.map((action) => (
          <Link
            key={action.id}
            to={action.href}
            className={
              action.primary
                ? 'acOwnerHomeNextCard acOwnerHomeNextCardPrimary'
                : 'acOwnerHomeNextCard'
            }
          >
            <div className="acOwnerHomeNextLabel">{action.label}</div>
            <p className="acOwnerHomeNextDesc">{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function OwnerHomeView() {
  const { t } = useI18n()
  const snapshot = useOwnerHome()

  return (
    <div className="acOwnerHomePage">
      <PageHeader title={t.ownerHome.title} description={t.ownerHome.description} />
      <section className="acOwnerHomeHero">
        <h2 className="acOwnerHomeHeroQuestion">{t.ownerHome.heroQuestion}</h2>
        <p className="acMuted">{t.ownerHome.heroHint}</p>
      </section>

      <div className="acOwnerHomeLayout">
        <div className="acOwnerHomeMain">
          <CompanyStatusPanel status={snapshot.companyStatus} />
          <CompletedTasksPanel tasks={snapshot.completedTasks} />
          <DecisionsPanel items={snapshot.decisionItems} />
        </div>
        <aside className="acOwnerHomeAside">
          <NextActionsPanel />
          <p className="mcMuted acOwnerHomeLocalNote">{t.ownerHome.localNote}</p>
        </aside>
      </div>
    </div>
  )
}
