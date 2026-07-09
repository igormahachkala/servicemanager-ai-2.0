import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useI18n } from '../../i18n'
import { MobileReportOwnerDetail } from '../components/MobileReportOwnerDetail'
import { useMobileReportDetail } from '../hooks/useMobileReportDetail'
import { buildMobileReportOwnerView } from '../reports/mobileReportOwnerView'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileReportDetailPage() {
  const { t } = useI18n()
  const copy = t.mobile.reports
  const { id } = useParams<{ id: string }>()
  const detail = useMobileReportDetail(id)

  const ownerView = useMemo(() => {
    if (!detail) return null
    return buildMobileReportOwnerView(detail, {
      defaultNextStepLabel: copy.ownerDetail.defaultNextStep,
    })
  }, [copy.ownerDetail.defaultNextStep, detail])

  if (!detail || !ownerView) {
    return (
      <div className="acMobilePage acMobileReportDetailPage">
        <div className="acMobileReportsEmpty">
          <h2 className="acMobileReportsEmptyTitle">{copy.detail.notFound}</h2>
          <Link to={MOBILE_PATHS.reports} className="acMobileLinkBtn acMobileReportsEmptyCta">
            {copy.detail.backToList}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="acMobilePage acMobileReportDetailPage">
      <Link to={MOBILE_PATHS.reports} className="acMobileReportDetailBack">
        {copy.detail.backToList}
      </Link>
      <MobileReportOwnerDetail view={ownerView} />
    </div>
  )
}
