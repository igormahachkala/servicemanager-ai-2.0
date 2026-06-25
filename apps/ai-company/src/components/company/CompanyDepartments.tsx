import { Link } from 'react-router-dom'
import type { Department } from '../../domain/organization/department'
import { useI18n } from '../../i18n'

export function CompanyDepartments(props: { departments: Department[] }) {
  const { t } = useI18n()

  if (props.departments.length === 0) {
    return <div className="mcEmpty">{t.companyEngine.departments.empty}</div>
  }

  return (
    <div className="mcStack">
      {props.departments.map((dept) => (
        <article key={dept.id} className="mcListRow">
          <div>
            <div className="mcListRowTitle">{dept.name}</div>
            <div className="mcMuted">{dept.description}</div>
          </div>
          <Link to={`/ops/organization/departments/${dept.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.companyEngine.departments.open}
          </Link>
        </article>
      ))}
      <Link to="/ops/organization" className="mcLink">
        {t.companyEngine.departments.viewOrg}
      </Link>
    </div>
  )
}
