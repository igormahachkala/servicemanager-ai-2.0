import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useCustomEmployees } from '../../mission-control/hooks/useCustomEmployees'
import { agents } from '../../mission-control/data/mock'
import { useI18n } from '../../i18n'

export function ProjectTeam({ project }: { project: Project }) {
  const { t } = useI18n()
  const { employees } = useCustomEmployees()

  const resolveName = (employeeId: string, label: string) => {
    if (label) return label
    const custom = employees.find((item) => item.id === employeeId)
    if (custom) return custom.name
    const agent = agents.find((item) => item.id === employeeId)
    return agent?.codename ?? employeeId
  }

  return (
    <Panel title={t.projects.team.title}>
      <div className="mcProfilePanelBody">
        {project.team.length === 0 ? (
          <p className="acMuted">{t.projects.team.empty}</p>
        ) : (
          <div className="acProjectTeamGrid">
            {project.team.map((member) => (
              <div key={member.employeeId} className="acProjectTeamCard">
                <div className="acProjectTeamAvatar" aria-hidden>
                  {resolveName(member.employeeId, member.label).charAt(0)}
                </div>
                <div>
                  <div className="acProjectTeamName">
                    {resolveName(member.employeeId, member.label)}
                  </div>
                  <div className="acMuted acMono" style={{ fontSize: 12 }}>
                    {t.projects.team.roles[member.role]}
                  </div>
                </div>
                <Link
                  to={`/ops/employees/${encodeURIComponent(member.employeeId)}`}
                  className="mcBtn mcBtnSecondary mcBtnSmall"
                >
                  {t.projects.team.viewProfile}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
