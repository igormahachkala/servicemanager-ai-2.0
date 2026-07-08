import { Link } from 'react-router-dom'
import type { CommandCenterChartPoint } from '../../domain/commandCenter'
import { AI_PHOTO_LAB_PROJECT_ID } from '../../domain/projects/aiPhotoLabIds'
import { AI_PHOTO_LAB_KICKOFF_PATH } from '../../domain/projects/aiPhotoLabKickoff'
import { AI_PHOTO_LAB_CONTROL_ROOM_PATH } from '../../domain/projects/aiPhotoLabControlRoom'
import { AI_PHOTO_LAB_SPRINT_PATH } from '../../domain/sprint/sprintStorage'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import { ownerNavItemHint } from '../../navigation/ownerNavPath'
import { Card } from '../layout'
import { useI18n } from '../../i18n'

const MAX = EMPLOYEE_ROUTE_IDS.max

const OWNER_QUICK_LAUNCH = [
  { id: 'morningReport' as const, to: '/ops/morning-report', primary: true },
  { id: 'runTask' as const, to: '/ops/run-task', primary: true },
  { id: 'maxToday' as const, to: `/ops/employees/${MAX}/today`, primary: true },
  { id: 'maxWorkspace' as const, to: `/ops/employees/${MAX}/workspace`, primary: true },
  { id: 'approvals' as const, to: '/ops/approvals', primary: true },
  { id: 'taskResults' as const, to: '/ops/task-results', primary: false },
  { id: 'operatingDay' as const, to: '/ops/day', primary: false },
  { id: 'handoffs' as const, to: '/ops/handoffs', primary: false },
] as const

const PROJECT_QUICK_LAUNCH = [
  { id: 'canvas' as const, to: `/ops/canvas?projectId=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}` },
  { id: 'sprint' as const, to: AI_PHOTO_LAB_SPRINT_PATH },
  { id: 'kickoff' as const, to: AI_PHOTO_LAB_KICKOFF_PATH },
  { id: 'controlRoom' as const, to: AI_PHOTO_LAB_CONTROL_ROOM_PATH },
  { id: 'atlas' as const, to: `/ops/employees/${EMPLOYEE_ROUTE_IDS.atlas}` },
  { id: 'runtime' as const, to: '/ops/runtime' },
] as const

export function QuickLaunchBar() {
  const { t } = useI18n()

  return (
    <section className="mcCommandCenterQuickLaunch">
      <div className="mcCommandCenterQuickLaunchLabel">{t.commandCenter.sections.quickLaunch}</div>
      <p className="acOwnerQuickLaunchHint">{t.ownerNav.quickLaunchHint}</p>
      <div className="mcCommandCenterQuickLaunchGrid">
        {OWNER_QUICK_LAUNCH.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={`acQuickActionBtn ${item.primary ? 'acQuickActionBtnPrimary' : ''}`}
            title={ownerNavItemHint(item.id, t)}
          >
            {t.ownerNav.items[item.id].label}
          </Link>
        ))}
      </div>
      <div className="acOwnerQuickLaunchSubLabel">{t.ownerNav.quickLaunchProjectLabel}</div>
      <div className="mcCommandCenterQuickLaunchGrid">
        {PROJECT_QUICK_LAUNCH.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="acQuickActionBtn"
            title={
              item.id === 'atlas'
                ? t.commandCenter.quickLaunch.atlas
                : item.id === 'canvas'
                  ? ownerNavItemHint('companyCanvas', t)
                  : item.id === 'runtime'
                    ? ownerNavItemHint('runtimeSettings', t)
                    : t.commandCenter.quickLaunch[item.id]
            }
          >
            {item.id === 'atlas' || item.id === 'kickoff' || item.id === 'controlRoom' || item.id === 'sprint'
              ? t.commandCenter.quickLaunch[item.id]
              : item.id === 'canvas'
                ? t.ownerNav.items.companyCanvas.label
                : t.ownerNav.items.runtimeSettings.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

type ChartProps = {
  charts: CommandCenterChartPoint[]
}

export function CommandChartsPanel({ charts }: ChartProps) {
  const { t } = useI18n()

  return (
    <Card title={t.commandCenter.sections.charts}>
      <div className="mcCommandCenterCharts">
        {charts.map((point) => {
          const pct = point.max > 0 ? Math.round((point.value / point.max) * 100) : 0
          return (
            <div key={point.id} className="mcCommandCenterChartRow">
              <span className="mcCommandCenterChartLabel">{t.commandCenter.charts[point.id]}</span>
              <div className="mcCommandCenterChartBar">
                <div className="mcCommandCenterChartFill" style={{ width: `${pct}%` }} />
              </div>
              <span className="mcCommandCenterChartValue">
                {point.value}/{point.max}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
