import { getEmployee, type EmployeeProfile } from '../../domain/employeeRegistry'
import { MobileCard } from './MobileCard'

export type MobileEmployeeRegistryProfileCopy = {
  department: string
  status: string
  workload: string
  manager: string
  reportsTo: string
  skills: string
  capabilities: string
  experience: string
  focusAreas: string
  preferredTools: string
  statusLabels: Record<string, string>
  skillLevels: Record<string, string>
}

type Props = {
  profile: EmployeeProfile
  copy: MobileEmployeeRegistryProfileCopy
}

function resolveEmployeeLabel(employeeId: string | null): string {
  if (!employeeId) return '—'
  return getEmployee(employeeId)?.displayName ?? employeeId
}

function formatWorkload(value: number): string {
  return `${Math.round(value)}%`
}

export function MobileEmployeeRegistryProfileCard({ profile, copy }: Props) {
  const enabledCapabilities = profile.capabilities.filter((item) => item.enabled)
  const disabledCapabilities = profile.capabilities.filter((item) => !item.enabled)

  return (
    <MobileCard
      title={profile.title}
      description={profile.experienceProfile.summary}
      status={{
        label: copy.statusLabels[profile.status] ?? profile.status,
        tone: profile.status === 'busy' ? 'warning' : profile.status === 'available' ? 'success' : 'default',
      }}
    >
      <dl className="acMobileRegistryProfile">
        <div className="acMobileRegistryProfileRow">
          <dt>{copy.department}</dt>
          <dd>{profile.department}</dd>
        </div>
        <div className="acMobileRegistryProfileRow">
          <dt>{copy.workload}</dt>
          <dd>{formatWorkload(profile.currentWorkload)}</dd>
        </div>
        <div className="acMobileRegistryProfileRow">
          <dt>{copy.manager}</dt>
          <dd>{resolveEmployeeLabel(profile.managerId)}</dd>
        </div>
        <div className="acMobileRegistryProfileRow">
          <dt>{copy.reportsTo}</dt>
          <dd>{resolveEmployeeLabel(profile.reportsTo)}</dd>
        </div>
      </dl>

      <section className="acMobileRegistryProfileSection">
        <h3 className="acMobileRegistryProfileHeading">{copy.skills}</h3>
        <ul className="acMobileRegistryProfileTags">
          {profile.skills.map((skill) => (
            <li key={skill.id} className="acMobileRegistryProfileTag">
              {skill.label}
              <span className="acMobileRegistryProfileTagMeta">
                {copy.skillLevels[skill.level] ?? skill.level}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="acMobileRegistryProfileSection">
        <h3 className="acMobileRegistryProfileHeading">{copy.capabilities}</h3>
        <ul className="acMobileRegistryProfileTags">
          {enabledCapabilities.map((capability) => (
            <li key={capability.id} className="acMobileRegistryProfileTag acMobileRegistryProfileTagEnabled">
              {capability.label}
            </li>
          ))}
          {disabledCapabilities.map((capability) => (
            <li key={capability.id} className="acMobileRegistryProfileTag acMobileRegistryProfileTagDisabled">
              {capability.label}
            </li>
          ))}
        </ul>
      </section>

      {profile.experienceProfile.focusAreas.length > 0 ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.focusAreas}</h3>
          <p className="acMobileRegistryProfileText">
            {profile.experienceProfile.focusAreas.join(' · ')}
          </p>
        </section>
      ) : null}

      {profile.preferredTools.length > 0 ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.preferredTools}</h3>
          <p className="acMobileRegistryProfileText">{profile.preferredTools.join(' · ')}</p>
        </section>
      ) : null}
    </MobileCard>
  )
}
