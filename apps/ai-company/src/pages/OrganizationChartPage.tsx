import { PageHeader, Panel } from '../mission-control/components/ui'
import { OrganizationTree } from '../components/organization/OrganizationTree'
import { DepartmentCard } from '../components/organization/DepartmentCard'
import { TeamCard } from '../components/organization/TeamCard'
import { OrganizationStats } from '../components/organization/OrganizationStats'
import { useOrganization } from '../hooks/useOrganization'
import { useI18n } from '../i18n'

function FuturePlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const { t } = useI18n()
  return (
    <div className="mcOrgFutureCard">
      <span className="mcOrgFutureBadge">{t.organizationEngine.futureBadge}</span>
      <div className="mcOrgFutureTitle">{title}</div>
      <p className="mcOrgFutureDesc mcMuted">{description}</p>
    </div>
  )
}

export function OrganizationChartPage() {
  const { t } = useI18n()
  const { tree, stats, departments, teams, getDepartmentById, getTeamsByDepartment } =
    useOrganization()

  return (
    <>
      <PageHeader
        title={t.pages.organization}
        description={t.organizationEngine.description}
      />

      <OrganizationStats stats={stats} />

      <div style={{ marginTop: 16 }}>
        <Panel title={t.organizationEngine.reportingTree}>
          <OrganizationTree tree={tree} />
        </Panel>
      </div>

      <div className="mcOrgSectionGrid">
        <Panel title={t.organizationEngine.departments}>
          <div className="mcOrgCardGrid">
            {departments.map((department) => {
              const deptTeams = getTeamsByDepartment(department.id)
              const memberCount = deptTeams.reduce((sum, team) => sum + team.members.length, 0)
              return (
                <DepartmentCard
                  key={department.id}
                  department={department}
                  teamCount={deptTeams.length}
                  memberCount={memberCount}
                />
              )
            })}
          </div>
        </Panel>

        <Panel title={t.organizationEngine.teams}>
          <div className="mcOrgCardGrid">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                department={getDepartmentById(team.departmentId)}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.organizationEngine.futureStructures}>
          <div className="mcOrgFutureGrid">
            <FuturePlaceholder
              title={t.organizationEngine.future.crossFunctional}
              description={t.organizationEngine.future.crossFunctionalDesc}
            />
            <FuturePlaceholder
              title={t.organizationEngine.future.matrix}
              description={t.organizationEngine.future.matrixDesc}
            />
            <FuturePlaceholder
              title={t.organizationEngine.future.temporarySquads}
              description={t.organizationEngine.future.temporarySquadsDesc}
            />
            <FuturePlaceholder
              title={t.organizationEngine.future.workspaceOverlay}
              description={t.organizationEngine.future.workspaceOverlayDesc}
            />
          </div>
        </Panel>
      </div>
    </>
  )
}
