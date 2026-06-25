import { Link } from 'react-router-dom'
import type { CompanyAssignment } from '../../domain/company/companyAssignment'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

export function CompanyEmployees(props: { assignments: CompanyAssignment[] }) {
  const { t } = useI18n()

  if (props.assignments.length === 0) {
    return <div className="mcEmpty">{t.companyEngine.employees.empty}</div>
  }

  return (
    <div className="mcStack">
      <p className="mcMuted">{t.companyEngine.employees.hint}</p>
      {props.assignments.map((item) => {
        const employee = resolveEmployee(item.employeeId)
        return (
          <article key={item.id} className="mcListRow">
            <div>
              <div className="mcListRowTitle">{employee?.codename ?? item.employeeId}</div>
              <div className="mcMuted">
                {item.title} · {item.role}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="mcBadge">{t.companyEngine.assignmentStatus[item.status]}</span>
              <Link to={`/ops/employees/${item.employeeId}`} className="mcBtn mcBtnSecondary mcBtnSmall">
                {t.companyEngine.employees.openProfile}
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )
}
