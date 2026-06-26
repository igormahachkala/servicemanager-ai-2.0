import { Link } from 'react-router-dom'
import { ReportCard } from '../reports/ReportCard'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function RecentReports({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.employeeWorkspace.sections.reports}
      right={
        <Link to="/ops/reports" className="mcBtn mcBtnSecondary mcBtnSm">
          {t.employeeWorkspace.openReports}
        </Link>
      }
    >
      <div className="mcProfilePanelBody acWorkspaceReportGrid">
        {snapshot.reports.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.reports}</p>
        ) : (
          snapshot.reports.map((report) => (
            <Link key={report.id} to={`/ops/reports/${report.id}`} className="acWorkspaceReportLink">
              <ReportCard report={report} />
            </Link>
          ))
        )}
      </div>
    </Panel>
  )
}
