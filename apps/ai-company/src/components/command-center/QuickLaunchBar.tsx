import { Link } from 'react-router-dom'
import type { CommandCenterChartPoint } from '../../domain/commandCenter'
import { AI_PHOTO_LAB_PROJECT_ID } from '../../domain/projects/aiPhotoLabIds'
import { AI_PHOTO_LAB_KICKOFF_PATH } from '../../domain/projects/aiPhotoLabKickoff'
import { AI_PHOTO_LAB_CONTROL_ROOM_PATH } from '../../domain/projects/aiPhotoLabControlRoom'
import { AI_PHOTO_LAB_SPRINT_PATH } from '../../domain/sprint/sprintStorage'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import { Card } from '../layout'
import { useI18n } from '../../i18n'

const QUICK_LAUNCH = [
  { id: 'atlas', to: `/ops/employees/${EMPLOYEE_ROUTE_IDS.atlas}`, labelKey: 'atlas' as const, primary: true },
  { id: 'max', to: `/ops/employees/${EMPLOYEE_ROUTE_IDS.max}`, labelKey: 'max' as const, primary: true },
  {
    id: 'canvas',
    to: `/ops/canvas?projectId=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`,
    labelKey: 'canvas' as const,
    primary: true,
  },
  { id: 'sprint', to: AI_PHOTO_LAB_SPRINT_PATH, labelKey: 'sprint' as const, primary: true },
  { id: 'kickoff', to: AI_PHOTO_LAB_KICKOFF_PATH, labelKey: 'kickoff' as const, primary: true },
  { id: 'controlRoom', to: AI_PHOTO_LAB_CONTROL_ROOM_PATH, labelKey: 'controlRoom' as const, primary: true },
  { id: 'runTask', to: '/ops/run-task', labelKey: 'runTask' as const, primary: true },
  { id: 'taskResults', to: '/ops/task-results', labelKey: 'taskResults' as const, primary: true },
  { id: 'handoffs', to: '/ops/handoffs', labelKey: 'handoffs' as const, primary: false },
  { id: 'runtime', to: '/ops/runtime', labelKey: 'runtime' as const, primary: false },
] as const

export function QuickLaunchBar() {
  const { t } = useI18n()

  return (
    <section className="mcCommandCenterQuickLaunch">
      <div className="mcCommandCenterQuickLaunchLabel">{t.commandCenter.sections.quickLaunch}</div>
      <div className="mcCommandCenterQuickLaunchGrid">
        {QUICK_LAUNCH.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={`acQuickActionBtn ${item.primary ? 'acQuickActionBtnPrimary' : ''}`}
          >
            {t.commandCenter.quickLaunch[item.labelKey]}
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
