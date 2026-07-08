import { useI18n } from '../../i18n'
import { MobileEmployeeRosterCard } from '../components/MobileEmployeeRosterCard'
import { MobileHireEmployeeCard } from '../components/MobileHireEmployeeCard'
import { MobileSection } from '../components/MobileSection'
import { useMobileEmployeesRoster } from '../hooks/useMobileEmployeesRoster'

export function MobileEmployeesPage() {
  const { t } = useI18n()
  const copy = t.mobile.employeesRoster
  const { roster } = useMobileEmployeesRoster()

  return (
    <div className="acMobileEmployeesPage">
      <MobileSection title={t.mobile.pages.employees} description={copy.pageDescription}>
        <p className="acMobileEmployeesFraming">{copy.companyFraming}</p>
      </MobileSection>

      <div className="acMobileRosterList">
        {roster.map((entry) => (
          <MobileEmployeeRosterCard key={entry.slotId} entry={entry} />
        ))}
      </div>

      <MobileSection title={copy.hireSectionTitle}>
        <MobileHireEmployeeCard />
      </MobileSection>
    </div>
  )
}
