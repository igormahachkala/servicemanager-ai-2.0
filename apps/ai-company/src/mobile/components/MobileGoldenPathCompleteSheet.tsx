import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { setMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

type Props = {
  reportHref: string
  onClose: () => void
}

export function MobileGoldenPathCompleteSheet({ reportHref, onClose }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const copy = t.mobile.goldenPath.complete

  const openReport = () => {
    setMobileGoldenPathActive(false)
    onClose()
    navigate(reportHref)
  }

  return (
    <div className="acMobileGoldenPathComplete">
      <p className="acMobileGoldenPathCompleteTitle">{copy.title}</p>
      <p className="acMobileGoldenPathCompleteDescription">{copy.description}</p>
      <div className="acMobileGoldenPathCompleteActions">
        <button type="button" className="acMobilePrimaryBtn" onClick={openReport}>
          {copy.openReport}
        </button>
        <Link to={MOBILE_PATHS.today} className="acMobileSecondaryBtn" onClick={() => {
          setMobileGoldenPathActive(false)
          onClose()
        }}>
          {copy.backToToday}
        </Link>
      </div>
    </div>
  )
}
