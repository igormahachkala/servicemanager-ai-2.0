import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import { EmployeeHeader } from '../components/EmployeeHeader'
import { EmployeeOverview } from '../components/EmployeeOverview'
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
import { useCustomEmployees } from '../hooks/useCustomEmployees'
import { useI18n } from '../../i18n'

type ProfileSection =
  | 'overview'
  | 'skills'
  | 'permissions'
  | 'memory'
  | 'knowledge'
  | 'relationships'
  | 'assignments'
  | 'activity'
  | 'runtime'
  | 'presence'

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { employees } = useCustomEmployees()
  const { getByEmployeeId, getWorkdayEventsForEmployee } = usePresence()
  const [section, setSection] = useState<ProfileSection>('overview')

  const employee = useMemo(
    () => employees.find((item) => item.id === id) ?? null,
    [employees, id],
  )

  const sections: ProfileSection[] = [
    'overview',
    'skills',
    'permissions',
    'memory',
    'knowledge',
    'relationships',
    'assignments',
    'activity',
    'runtime',
    'presence',
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
        {section === 'overview' ? <EmployeeOverview employee={employee} /> : null}
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
            <CurrentWorkPanel presence={getByEmployeeId(employee.id)} employeeId={employee.id} />
            <Panel title={t.presence.timeline.title}>
              <p className="acMuted" style={{ marginBottom: 12 }}>
                {t.presence.timeline.description}
              </p>
              <WorkdayTimeline events={getWorkdayEventsForEmployee(employee.id)} />
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  )
}
