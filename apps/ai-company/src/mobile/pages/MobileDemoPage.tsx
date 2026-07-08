import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileDemoChecklist } from '../components/MobileDemoChecklist'
import { MobileSection } from '../components/MobileSection'
import { useMobileDemo } from '../hooks/useMobileDemo'
import { MOBILE_DEMO_TASK } from '../demo/mobileDemoSeed'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileDemoPage() {
  const { t } = useI18n()
  const copy = t.mobile.demo
  const navigate = useNavigate()
  const demo = useMobileDemo()

  const handlePrepare = () => {
    demo.prepareDemo()
    navigate(MOBILE_PATHS.today)
  }

  const handleStartSession = () => {
    demo.startDemoSession()
  }

  return (
    <div className="acMobileDemoPage">
      <p className="acMobileDemoIntro">{copy.intro}</p>

      <MobileSection title={copy.mode.title} description={copy.mode.description}>
        <div className="acMobileDemoModeRow">
          <span className={`acMobileDemoModeBadge${demo.enabled ? ' acMobileDemoModeBadgeOn' : ''}`}>
            {demo.enabled ? copy.mode.on : copy.mode.off}
          </span>
          {demo.enabled ? (
            <button type="button" className="acMobileSecondaryBtn" onClick={demo.disableDemoMode}>
              {copy.actions.disableMode}
            </button>
          ) : (
            <button type="button" className="acMobilePrimaryBtn" onClick={demo.enableDemoMode}>
              {copy.actions.enableMode}
            </button>
          )}
        </div>
      </MobileSection>

      <MobileSection title={copy.prepare.title} description={copy.prepare.description}>
        <dl className="acMobileDemoTaskPreview">
          <div className="acMobileDemoTaskRow">
            <dt>{copy.prepare.taskLabel}</dt>
            <dd>{MOBILE_DEMO_TASK.title}</dd>
          </div>
          <div className="acMobileDemoTaskRow">
            <dt>{copy.prepare.textLabel}</dt>
            <dd>{MOBILE_DEMO_TASK.taskText}</dd>
          </div>
        </dl>
        <div className="acMobileDemoActions">
          <button type="button" className="acMobilePrimaryBtn" onClick={handlePrepare}>
            {copy.actions.prepareDemo}
          </button>
          <button type="button" className="acMobileSecondaryBtn" onClick={handleStartSession}>
            {copy.actions.startSession}
          </button>
          <button type="button" className="acMobileSecondaryBtn" onClick={demo.seedDemoTask}>
            {copy.actions.seedTaskOnly}
          </button>
        </div>
        <p className="acMobileDemoHint">{copy.prepare.hint}</p>
      </MobileSection>

      <MobileSection title={copy.reset.title} description={copy.reset.description}>
        <button type="button" className="acMobileSecondaryBtn acMobileDemoResetBtn" onClick={demo.resetDemoData}>
          {copy.actions.resetData}
        </button>
      </MobileSection>

      {demo.checklist ? (
        <MobileSection title={copy.checklistTitle} description={copy.checklistDescription}>
          <MobileDemoChecklist checklist={demo.checklist} />
        </MobileSection>
      ) : (
        <p className="acMobileDemoEmptyChecklist">{copy.emptyChecklist}</p>
      )}

      <div className="acMobileDemoFooterLinks">
        <Link to={MOBILE_PATHS.today} className="acMobileSecondaryBtn">
          {copy.actions.openToday}
        </Link>
        <Link to={MOBILE_PATHS.more} className="acMobileSecondaryBtn">
          {copy.actions.backToMore}
        </Link>
      </div>

      <p className="acMobileDemoLocalNote">{copy.localNote}</p>
    </div>
  )
}
