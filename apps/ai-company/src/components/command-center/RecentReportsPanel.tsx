import { Link } from 'react-router-dom'
import type { Report } from '../../domain/reports/report'
import { Card, DataTable } from '../layout'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'
import { reportTypeLabel } from '../../i18n/uiLabels'

type Props = {
  reports: Report[]
}

export function RecentReportsPanel({ reports }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.recentReports}
      action={<Link to="/ops/reports" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      {reports.length === 0 ? (
        <div className="acMuted">{t.commandCenter.empty.reports}</div>
      ) : (
        <DataTable>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <Link to={`/ops/reports/${encodeURIComponent(report.id)}`} className="acLink">
                    {report.title}
                  </Link>
                </td>
                <td className="acMono acMuted">{reportTypeLabel(t, report.type)}</td>
                <td className="acMono acMuted">{formatFeedTime(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  )
}
