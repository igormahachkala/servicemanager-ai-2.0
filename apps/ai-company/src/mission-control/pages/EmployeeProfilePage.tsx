import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import { EmployeeHeader } from '../components/EmployeeHeader'
import { EmployeeIdentityPassport } from '../components/EmployeeIdentityPassport'
import { EmployeeSkills } from '../components/EmployeeSkills'
import { EmployeePermissions } from '../components/EmployeePermissions'
import { EmployeeMemory } from '../components/EmployeeMemory'
import { EmployeeRelationships } from '../components/EmployeeRelationships'
import { EmployeeAssignedKnowledge } from '../../components/knowledge/EmployeeAssignedKnowledge'
import { EmployeeAssignments } from '../components/EmployeeAssignments'
import { EmployeeActivity } from '../components/EmployeeActivity'
import { CurrentWorkPanel, WorkdayTimeline } from '../../components/presence'
import { usePresence } from '../../hooks/usePresence'
import { EmployeeRuntime } from '../../components/EmployeeRuntime'
import { EmployeeLearningPreview } from '../../components/learning/EmployeeLearningPreview'
import { EmployeeLivingTimeline } from '../../components/employee-timeline'
import { resolveProfileEmployee } from '../data/employeeProfileResolver'
import { resolveCanonicalEmployeeId } from '../data/employeeIdResolver'
import { useI18n } from '../../i18n'

type ProfileSection =
  | 'overview'
  | 'timeline'
  | 'skills'
  | 'permissions'
  | 'memory'
  | 'knowledge'
  | 'relationships'
  | 'assignments'
  | 'activity'
  | 'runtime'
  | 'presence'
  | 'learning'

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getByEmployeeId, getWorkdayEventsForEmployee } = usePresence()
  const [section, setSection] = useState<ProfileSection>('overview')

  const employee = useMemo(() => {
    if (!id) return null
    return resolveProfileEmployee(id)
  }, [id])

  const canonicalId = id ? resolveCanonicalEmployeeId(id) : null

  const sections: ProfileSection[] = [
    'overview',
    'timeline',
    'skills',
    'permissions',
    'memory',
    'knowledge',
    'relationships',
    'assignments',
    'activity',
    'runtime',
    'presence',
    'learning',
  ]

  if (!employee) {
    return (
      <>
        <PageHeader
          title={t.employeeProfile.notFoundTitle}
          description={t.employeeProfile.notFoundDescription}
        />
        <div className="mcProfileEmpty mcProfileEmptyPage">
          <div className="mcProfileEmptyTitle">{t.employeeProfile.notFoundTitle}</div>
          <p className="mcProfileEmptyDesc">{t.employeeProfile.notFoundDescription}</p>
          <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
            {t.employeeProfile.backToEmployees}
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="mcProfilePage">
      <EmployeeHeader employee={employee} />

      <Panel title={t.employeeTimelineEngine.title}>
        <div className="mcProfilePanelBody">
          <EmployeeLivingTimeline employeeId={employee.id} compact />
        </div>
      </Panel>

      <nav className="mcProfileNav" aria-label={t.employeeProfile.navLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.employeeProfile.sections[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? <EmployeeIdentityPassport employee={employee} /> : null}
        {section === 'timeline' ? <EmployeeLivingTimeline employeeId={employee.id} /> : null}
        {section === 'timeline' ? <EmployeeLivingTimeline employeeId={employee.id} /> : null}
        {section === 'skills' ? <EmployeeSkills employee={employee} /> : null}
        {section === 'permissions' ? <EmployeePermissions employee={employee} /> : null}
        {section === 'memory' ? <EmployeeMemory employee={employee} /> : null}
        {section === 'knowledge' ? <EmployeeAssignedKnowledge employeeId={employee.id} /> : null}
        {section === 'relationships' ? <EmployeeRelationships employeeId={employee.id} /> : null}
        {section === 'assignments' ? <EmployeeAssignments employeeId={employee.id} /> : null}
        {section === 'activity' ? <EmployeeActivity employeeId={employee.id} /> : null}
        {section === 'runtime' ? <EmployeeRuntime employee={employee} /> : null}
        {section === 'presence' ? (
          <div className="mcProfileGrid">
            <CurrentWorkPanel
              presence={getByEmployeeId(canonicalId ?? employee.id)}
              employeeId={canonicalId ?? employee.id}
            />
            <Panel title={t.presence.timeline.title}>
              <p className="acMuted" style={{ marginBottom: 12 }}>
                {t.presence.timeline.description}
              </p>
              <WorkdayTimeline events={getWorkdayEventsForEmployee(employee.id)} />
            </Panel>
          </div>
        ) : null}
        {section === 'learning' ? <EmployeeLearningPreview employee={employee} /> : null}
      </div>
    </div>
  )
}
