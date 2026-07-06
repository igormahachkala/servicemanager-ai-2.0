import { Link } from 'react-router-dom'
import { OwnerMorningReportView } from '../components/morning-report'
import { PageHeader } from '../components/layout'
import { useOwnerMorningReport } from '../hooks/useOwnerMorningReport'
import { useI18n } from '../i18n'

export function OwnerMorningReportPage() {
  const { t } = useI18n()
  const { snapshot } = useOwnerMorningReport()
  const mr = t.morningReport

  return (
    <div className="acMorningReportPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={mr.pageTitle} description={mr.pageDescription} />
        <div className="acMorningReportHeaderActions">
          <Link to="/ops" className="mcBtn mcBtnSecondary">
            {t.commandCenter.title}
          </Link>
          <Link to="/ops/run-task" className="mcBtn mcBtnSecondary">
            {t.pages.runTask}
          </Link>
        </div>
      </div>

      <OwnerMorningReportView snapshot={snapshot} />
    </div>
  )
}
