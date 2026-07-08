import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'

const COLLAPSED_STORAGE_KEY = 'ai-company-first-five-minutes-collapsed'
const MAX = MAX_WORKER_EMPLOYEE_ID

const STEP_IDS = [
  'companyState',
  'openMax',
  'assignTask',
  'startWorkday',
  'morningReport',
  'ownerDecisions',
] as const

type StepId = (typeof STEP_IDS)[number]

const STEP_HREFS: Record<StepId, string> = {
  companyState: '/ops',
  openMax: `/ops/employees/${MAX}/workspace`,
  assignTask: `/ops/run-task?employee=${MAX}`,
  startWorkday: `/ops/employees/${MAX}/today`,
  morningReport: '/ops/morning-report',
  ownerDecisions: '/ops/approvals',
}

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
}

export function FirstFiveMinutesGuide() {
  const { t } = useI18n()
  const g = t.firstFiveMinutesGuide
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((open) => {
      const next = !open
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      }
      return next
    })
  }, [])

  return (
    <section className="acFirstFiveGuide" aria-label={g.title}>
      <header className="acFirstFiveGuideHeader">
        <div className="acFirstFiveGuideIntro">
          <h2 className="acFirstFiveGuideTitle">{g.title}</h2>
          <p className="acFirstFiveGuideSubtitle">{g.subtitle}</p>
        </div>
        <div className="acFirstFiveGuideActions">
          <Link to={g.ctaHref} className="mcBtn mcBtnPrimary mcBtnSm">
            {g.cta}
          </Link>
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={toggleCollapsed}>
            {collapsed ? g.expand : g.collapse}
          </button>
        </div>
      </header>

      {collapsed ? (
        <nav className="acFirstFiveGuideCompact" aria-label={g.compactNavAria}>
          <ol className="acFirstFiveGuideCompactList">
            {STEP_IDS.map((stepId, index) => (
              <li key={stepId}>
                <Link to={STEP_HREFS[stepId]} className="acFirstFiveGuideCompactLink">
                  <span className="acFirstFiveGuideStepNum">{index + 1}</span>
                  {g.steps[stepId].title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : (
        <ol className="acFirstFiveGuideSteps">
          {STEP_IDS.map((stepId, index) => {
            const step = g.steps[stepId]
            return (
              <li key={stepId} className="acFirstFiveGuideStep">
                <div className="acFirstFiveGuideStepHead">
                  <span className="acFirstFiveGuideStepNum">{index + 1}</span>
                  <Link to={STEP_HREFS[stepId]} className="acFirstFiveGuideStepTitle">
                    {step.title}
                  </Link>
                </div>
                <dl className="acFirstFiveGuideStepMeta">
                  <div className="acFirstFiveGuideMetaRow">
                    <dt>{g.stepMeta.whatItIs}</dt>
                    <dd>{step.whatItIs}</dd>
                  </div>
                  <div className="acFirstFiveGuideMetaRow">
                    <dt>{g.stepMeta.why}</dt>
                    <dd>{step.why}</dd>
                  </div>
                  <div className="acFirstFiveGuideMetaRow">
                    <dt>{g.stepMeta.afterClick}</dt>
                    <dd>{step.afterClick}</dd>
                  </div>
                  <div className="acFirstFiveGuideMetaRow">
                    <dt>{g.stepMeta.expectedResult}</dt>
                    <dd>{step.expectedResult}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
