import { Link } from 'react-router-dom'
import { OperatingDayBoard, OperatingDayLinksBar } from '../components/operating-day'
import { useOperatingDay } from '../hooks/useOperatingDay'
import { PageHeader } from '../components/layout'
import { PageGuideCard } from '../components/guided'
import { useI18n } from '../i18n'

export function CompanyOperatingDayPage() {
  const { t } = useI18n()
  const { snapshot } = useOperatingDay()
  const od = t.operatingDayEngine

  return (
    <div className="acOperatingDayPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={od.title} description={od.pageDescription} />
        <div className="acOperatingDayHeaderActions">
          <Link to="/ops/presence" className="mcBtn mcBtnSecondary">
            {t.pages.presence}
          </Link>
          <Link to="/ops/workday" className="mcBtn mcBtnSecondary">
            {t.pages.workday}
          </Link>
        </div>
      </div>

      <PageGuideCard pageId="operatingDay" />

      <OperatingDayLinksBar />

      <div className="acOperatingDayMeta">
        <span className="acMono">{snapshot.dateKey}</span>
        <span className="acOperatingDayMetaSep">·</span>
        <span>{od.timeOfDay[snapshot.timeOfDay]}</span>
      </div>

      <OperatingDayBoard snapshot={snapshot} />

      <p className="mcMemoryLocalNote">{od.localNote}</p>
    </div>
  )
}
