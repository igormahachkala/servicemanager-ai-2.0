import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useFirstEmployeeFlowStatus } from '../../hooks/useFirstEmployeeFlowStatus'
import { useI18n } from '../../i18n'

const MAX = MAX_WORKER_EMPLOYEE_ID

const STEP_IDS = [
  'hired',
  'openWorkspace',
  'addTask',
  'startWorkday',
  'runTask',
  'viewReport',
] as const

const STEP_HREFS: Partial<Record<(typeof STEP_IDS)[number], string>> = {
  openWorkspace: `/ops/employees/${MAX}/workspace`,
  addTask: `/ops/run-task?employee=${MAX}`,
  startWorkday: `/ops/employees/${MAX}/today`,
  runTask: `/ops/run-task?employee=${MAX}`,
  viewReport: '/ops/morning-report',
}

const CTA_IDS = ['openMax', 'assignTask', 'startWorkday', 'morningReport'] as const

const CTA_HREFS: Record<(typeof CTA_IDS)[number], string> = {
  openMax: `/ops/employees/${MAX}/workspace`,
  assignTask: `/ops/run-task?employee=${MAX}`,
  startWorkday: `/ops/employees/${MAX}/today`,
  morningReport: '/ops/morning-report',
}

export function FirstEmployeeNavigationGuide() {
  const { t } = useI18n()
  const g = t.firstEmployeeNavigation
  const status = useFirstEmployeeFlowStatus()

  return (
    <section className="acFirstEmployeeGuide" aria-label={g.title}>
      <header className="acFirstEmployeeGuideHeader">
        <div>
          <h2 className="acFirstEmployeeGuideTitle">{g.title}</h2>
          <p
            className={
              status.hasPriorActivity
                ? 'acFirstEmployeeGuideStatus acFirstEmployeeGuideStatusActive'
                : 'acFirstEmployeeGuideStatus'
            }
          >
            {status.hasPriorActivity ? g.statusHasActivity : g.statusReady}
          </p>
        </div>
      </header>

      <ol className="acFirstEmployeeGuideSteps" aria-label={g.stepsAria}>
        {STEP_IDS.map((stepId, index) => {
          const href = STEP_HREFS[stepId]
          const label = g.steps[stepId]
          return (
            <li key={stepId} className="acFirstEmployeeGuideStep">
              <span className="acFirstEmployeeGuideStepNum">{index + 1}</span>
              {href ? (
                <Link to={href} className="acFirstEmployeeGuideStepLink">
                  {label}
                </Link>
              ) : (
                <span className="acFirstEmployeeGuideStepText">{label}</span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="acFirstEmployeeGuideCtas" aria-label={g.ctasAria}>
        {CTA_IDS.map((ctaId) => (
          <Link
            key={ctaId}
            to={CTA_HREFS[ctaId]}
            className={
              ctaId === 'openMax' || ctaId === 'assignTask'
                ? 'mcBtn mcBtnPrimary mcBtnSm acFirstEmployeeGuideCta'
                : 'mcBtn mcBtnSecondary mcBtnSm acFirstEmployeeGuideCta'
            }
          >
            {g.ctas[ctaId]}
          </Link>
        ))}
      </div>
    </section>
  )
}
