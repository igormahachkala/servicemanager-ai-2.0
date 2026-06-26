import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function ReportPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.photoLabControlRoom.sections.reports}
      right={
        <Link to="/ops/reports" className="mcLink">
          {t.photoLabControlRoom.openReports}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        {snapshot.reports.length === 0 ? (
          <div className="mcControlRoomEmpty">{t.photoLabControlRoom.empty.reports}</div>
        ) : (
          <ul className="mcControlRoomReportList">
            {snapshot.reports.map((report) => (
              <li key={report.id} className="mcControlRoomReportCard">
                <Link to={`/ops/reports/${encodeURIComponent(report.id)}`} className="mcControlRoomReportTitle">
                  {report.title}
                </Link>
                <span className="mcControlRoomBadge">{report.type}</span>
                <p className="mcMuted">{report.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
