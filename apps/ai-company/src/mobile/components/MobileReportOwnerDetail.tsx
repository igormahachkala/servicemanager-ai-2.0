import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { setMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import type { MobileReportOwnerView } from '../reports/mobileReportOwnerView'
import { MOBILE_PATHS, resolveMobileHref } from '../navigation/mobileHrefResolver'

type Props = {
  view: MobileReportOwnerView
}

function OwnerSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="acMobileReportOwnerSection">
      <h2 className="acMobileReportOwnerSectionTitle">{title}</h2>
      <ul className="acMobileReportOwnerList">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function MobileReportOwnerDetail({ view }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.reports
  const ownerCopy = copy.ownerDetail
  const goldenCopy = t.mobile.goldenPath

  const finishGoldenPath = () => {
    setMobileGoldenPathActive(false)
  }

  const statusLabel = ownerCopy.statuses[view.statusKey]

  return (
    <>
      <header className="acMobileReportOwnerHeader">
        <h1 className="acMobileReportOwnerTitle">{view.taskTitle}</h1>
        <dl className="acMobileReportOwnerMeta">
          <div className="acMobileReportOwnerMetaRow">
            <dt>{copy.fields.employee}</dt>
            <dd>{view.employeeLabel}</dd>
          </div>
          <div className="acMobileReportOwnerMetaRow">
            <dt>{copy.fields.status}</dt>
            <dd>
              <span className={`acMobileReportOwnerStatus acMobileReportOwnerStatus--${view.statusTone}`}>
                {statusLabel}
              </span>
            </dd>
          </div>
          <div className="acMobileReportOwnerMetaRow">
            <dt>{ownerCopy.date}</dt>
            <dd>{view.dateLabel}</dd>
          </div>
        </dl>
      </header>

      {view.briefSummary ? (
        <section className="acMobileReportOwnerSummary" aria-label={ownerCopy.briefSummary}>
          <h2 className="acMobileReportOwnerSummaryLabel">{ownerCopy.briefSummary}</h2>
          <p className="acMobileReportOwnerSummaryText">{view.briefSummary}</p>
        </section>
      ) : null}

      <OwnerSection title={ownerCopy.checked} items={view.checked} />
      <OwnerSection title={ownerCopy.findings} items={view.findings} />
      <OwnerSection title={ownerCopy.risks} items={view.risks} />
      <OwnerSection title={ownerCopy.recommendations} items={view.recommendations} />

      {view.ownerDecisionRequired ? (
        <section className="acMobileReportOwnerDecision" role="status">
          <h2 className="acMobileReportOwnerDecisionTitle">{ownerCopy.ownerDecision}</h2>
          <p className="acMobileReportOwnerDecisionText">{view.ownerDecisionRequired}</p>
        </section>
      ) : null}

      <section className="acMobileReportOwnerNextStep">
        <h2 className="acMobileReportOwnerNextStepLabel">{ownerCopy.nextStep}</h2>
        <Link
          to={view.nextStep.href}
          className="acMobilePrimaryBtn acMobileReportOwnerNextStepCta"
          onClick={view.nextStep.finishGoldenPath ? finishGoldenPath : undefined}
        >
          {view.nextStep.headline}
        </Link>
      </section>

      <details className="acMobileReportOwnerTechnical">
        <summary className="acMobileReportOwnerTechnicalSummary">{ownerCopy.technical.title}</summary>
        <div className="acMobileReportOwnerTechnicalBody">
          {view.technical.reportKind ? (
            <dl className="acMobileReportOwnerTechnicalRow">
              <dt>{ownerCopy.technical.reportKind}</dt>
              <dd>{copy.kinds[view.technical.reportKind as keyof typeof copy.kinds]}</dd>
            </dl>
          ) : null}
          {view.technical.reportStatus ? (
            <dl className="acMobileReportOwnerTechnicalRow">
              <dt>{ownerCopy.technical.reportStatus}</dt>
              <dd>{copy.statuses[view.technical.reportStatus as keyof typeof copy.statuses] ?? view.technical.reportStatus}</dd>
            </dl>
          ) : null}
          {view.technical.models.length > 0 ? (
            <div className="acMobileReportOwnerTechnicalBlock">
              <h3 className="acMobileReportOwnerTechnicalBlockTitle">{ownerCopy.technical.model}</h3>
              <ul className="acMobileReportOwnerTechnicalList">
                {view.technical.models.map((item) => (
                  <li key={`model-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.technical.tools.length > 0 ? (
            <div className="acMobileReportOwnerTechnicalBlock">
              <h3 className="acMobileReportOwnerTechnicalBlockTitle">{ownerCopy.technical.tools}</h3>
              <ul className="acMobileReportOwnerTechnicalList">
                {view.technical.tools.map((item) => (
                  <li key={`tool-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.technical.consultations.length > 0 ? (
            <div className="acMobileReportOwnerTechnicalBlock">
              <h3 className="acMobileReportOwnerTechnicalBlockTitle">{ownerCopy.technical.consultations}</h3>
              <ul className="acMobileReportOwnerTechnicalList">
                {view.technical.consultations.map((item) => (
                  <li key={`consult-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.technical.runtimeRunId ? (
            <dl className="acMobileReportOwnerTechnicalRow">
              <dt>{ownerCopy.technical.runtimeRunId}</dt>
              <dd>
                <code>{view.technical.runtimeRunId}</code>
              </dd>
            </dl>
          ) : null}
          {view.technical.workerLoopId ? (
            <dl className="acMobileReportOwnerTechnicalRow">
              <dt>{ownerCopy.technical.workerLoopId}</dt>
              <dd>
                <code>{view.technical.workerLoopId}</code>
              </dd>
            </dl>
          ) : null}
          {view.technical.links.length > 0 ? (
            <div className="acMobileReportOwnerTechnicalBlock">
              <h3 className="acMobileReportOwnerTechnicalBlockTitle">{copy.detail.links}</h3>
              <ul className="acMobileReportOwnerTechnicalLinks">
                {view.technical.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link to={resolveMobileHref(link.href)} className="acMobileLinkBtn">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.technical.rawReport ? (
            <div className="acMobileReportOwnerTechnicalBlock">
              <h3 className="acMobileReportOwnerTechnicalBlockTitle">{ownerCopy.technical.rawReport}</h3>
              <pre className="acMobileReportOwnerRawReport">{view.technical.rawReport}</pre>
            </div>
          ) : null}
        </div>
      </details>

      <div className="acMobileReportDetailFooter">
        <Link
          to={MOBILE_PATHS.today}
          className="acMobileSecondaryBtn acMobileReportDetailFooterSecondary"
          onClick={finishGoldenPath}
        >
          {goldenCopy.reportDetail.backToToday}
        </Link>
        <Link
          to={MOBILE_PATHS.reports}
          className="acMobileTertiaryLinkBtn acMobileReportDetailFooterSecondary"
          onClick={finishGoldenPath}
        >
          {goldenCopy.reportDetail.allReports}
        </Link>
      </div>
    </>
  )
}
