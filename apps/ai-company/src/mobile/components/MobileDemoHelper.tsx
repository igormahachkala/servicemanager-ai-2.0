import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MobileDemoChecklistView } from '../demo/mobileDemoViewModel'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

type Props = {
  checklist: MobileDemoChecklistView
}

export function MobileDemoHelper({ checklist }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.demo.helper

  if (checklist.isComplete) return null

  const current = checklist.steps.find((step) => step.status === 'current')
  if (!current) return null

  return (
    <aside className="acMobileDemoHelper" aria-label={copy.ariaLabel}>
      <div className="acMobileDemoHelperText">
        <p className="acMobileDemoHelperEyebrow">{copy.eyebrow}</p>
        <p className="acMobileDemoHelperTitle">{t.mobile.demo.steps[current.id].title}</p>
        <p className="acMobileDemoHelperProgress">
          {checklist.completedCount}/{checklist.totalCount} · {checklist.progressPercent}%
        </p>
      </div>
      <div className="acMobileDemoHelperActions">
        <Link to={current.href} className="acMobilePrimaryBtn acMobileDemoHelperGo">
          {t.mobile.demo.steps[current.id].action}
        </Link>
        <Link to={MOBILE_PATHS.demo} className="acMobileDemoHelperOpen">
          {copy.openChecklist}
        </Link>
      </div>
    </aside>
  )
}
