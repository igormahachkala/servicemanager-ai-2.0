import { Link, useParams } from 'react-router-dom'
import { EmployeeOperatingDayWorkspace } from '../components/employee-operating-day'
import { useEmployeeOperatingDay } from '../hooks/useEmployeeOperatingDay'
import { PageHeader } from '../components/layout'
import { resolveProfileEmployee } from '../mission-control/data/employeeProfileResolver'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'
import { useI18n } from '../i18n'

export function EmployeeOperatingDayPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const { t } = useI18n()
  const employeeId = routeId ? resolveCanonicalEmployeeId(routeId) : undefined
  const employee = routeId ? resolveProfileEmployee(routeId) : null
  const { snapshot, start, continueDay, finish, pause, resume } = useEmployeeOperatingDay(employeeId)
  const eod = t.employeeOperatingDay

  if (!employeeId || !employee || !snapshot) {
    return (
      <div className="acEmployeeOperatingDayPage">
        <PageHeader title={eod.title} description={eod.notFoundDescription} />
        <div className="mcProfileEmpty mcProfileEmptyPage">
          <div className="mcProfileEmptyTitle">{t.employeeProfile.notFoundTitle}</div>
          <p className="mcProfileEmptyDesc">{eod.notFoundDescription}</p>
          <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
            {t.employeeProfile.backToEmployees}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="acEmployeeOperatingDayPage">
      <div className="mcPageHeaderRow">
        <PageHeader
          title={eod.pageTitle.replace('{name}', employee.codename)}
          description={eod.pageDescription}
        />
        <div className="acEmployeeOperatingDayHeaderActions">
          <Link
            to={`/ops/employees/${encodeURIComponent(employee.id)}`}
            className="mcBtn mcBtnSecondary"
          >
            {eod.openProfile}
          </Link>
          <Link
            to={`/ops/employees/${encodeURIComponent(employee.id)}/workspace`}
            className="mcBtn mcBtnSecondary"
          >
            {t.employeeWorkspace.openWorkspace}
          </Link>
          <Link to="/ops/workday" className="mcBtn mcBtnSecondary">
            {t.pages.workday}
          </Link>
        </div>
      </div>

      <EmployeeOperatingDayWorkspace
        snapshot={snapshot}
        onStart={start}
        onContinue={continueDay}
        onFinish={finish}
        onPause={pause}
        onResume={resume}
      />

      <p className="mcMemoryLocalNote">{eod.localNote}</p>
    </div>
  )
}
