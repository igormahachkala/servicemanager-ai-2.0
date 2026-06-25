import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useReports } from '../../hooks/useReports'
import { useI18n } from '../../i18n'

export function ProjectReports({ project }: { project: Project }) {
  const { t } = useI18n()
  const { reports } = useReports()

  const related = reports.filter((report) => report.workspaceId === project.workspaceId).slice(0, 6)

  return (
    <Panel title={t.projects.reports.title}>
      <p className="acMuted" style={{ marginBottom: 12 }}>
        {t.projects.reports.description}
      </p>
      {related.length === 0 ? (
        <p className="acMuted">{t.projects.reports.empty}</p>
      ) : (
        <div className="acProjectReportList">
          {related.map((report) => (
            <Link
              key={report.id}
              to={`/ops/reports/${encodeURIComponent(report.id)}`}
              className="acProjectReportRow"
            >
              <span>{report.title}</span>
              <span className="acMono acMuted">{report.type}</span>
            </Link>
          ))}
        </div>
      )}
      <Link to="/ops/reports" className="mcBtn mcBtnSecondary mcBtnSmall" style={{ marginTop: 12 }}>
        {t.projects.reports.viewAll}
      </Link>
    </Panel>
  )
}
