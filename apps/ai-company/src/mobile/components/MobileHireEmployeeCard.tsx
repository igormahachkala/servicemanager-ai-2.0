import { useI18n } from '../../i18n'

export function MobileHireEmployeeCard() {
  const { t } = useI18n()
  const copy = t.mobile.employeesRoster.hire

  return (
    <article className="acMobileHireCard" aria-label={copy.title}>
      <div className="acMobileHireCardIcon" aria-hidden>
        +
      </div>
      <div className="acMobileHireCardBody">
        <h3 className="acMobileHireCardTitle">{copy.title}</h3>
        <p className="acMobileHireCardDescription">{copy.description}</p>
      </div>
      <button type="button" className="acMobileSecondaryBtn" disabled>
        {copy.action}
      </button>
    </article>
  )
}
