import { Link, useParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useMobileReportDetail } from '../hooks/useMobileReportDetail'

function DetailSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="acMobileReportDetailSection">
      <h3 className="acMobileReportDetailSectionTitle">{title}</h3>
      <ul className="acMobileReportDetailList">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function MobileReportDetailPage() {
  const { t } = useI18n()
  const copy = t.mobile.reports
  const { id } = useParams<{ id: string }>()
  const detail = useMobileReportDetail(id)

  if (!detail) {
    return (
      <div className="acMobileReportDetailPage">
        <div className="acMobileReportsEmpty">
          <h2 className="acMobileReportsEmptyTitle">{copy.detail.notFound}</h2>
          <Link to="/mobile/reports" className="acMobileLinkBtn acMobileReportsEmptyCta">
            {copy.detail.backToList}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="acMobileReportDetailPage">
      <Link to="/mobile/reports" className="acMobileReportDetailBack">
        {copy.detail.backToList}
      </Link>

      <header className="acMobileReportDetailHeader">
        <span className={`acMobileReportKind acMobileReportKind--${detail.statusTone}`}>
          {copy.kinds[detail.kind]}
        </span>
        <h1 className="acMobileReportDetailTitle">{detail.title}</h1>
        <p className="acMobileReportDetailDate">{detail.dateLabel}</p>
      </header>

      <dl className="acMobileReportDetailMeta">
        <div className="acMobileReportDetailRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{detail.employeeLabel}</dd>
        </div>
        {detail.taskTitle ? (
          <div className="acMobileReportDetailRow">
            <dt>{copy.fields.task}</dt>
            <dd>{detail.taskTitle}</dd>
          </div>
        ) : null}
        {detail.taskText ? (
          <div className="acMobileReportDetailRow">
            <dt>{copy.fields.taskText}</dt>
            <dd>{detail.taskText}</dd>
          </div>
        ) : null}
        <div className="acMobileReportDetailRow">
          <dt>{copy.fields.summary}</dt>
          <dd>{detail.summary}</dd>
        </div>
        <div className="acMobileReportDetailRow">
          <dt>{copy.fields.status}</dt>
          <dd>
            <span className={`acMobileReportStatus acMobileReportStatus--${detail.statusTone}`}>
              {copy.statuses[detail.status as keyof typeof copy.statuses] ?? detail.status}
            </span>
          </dd>
        </div>
      </dl>

      <DetailSection title={copy.detail.findings} items={detail.findings} />
      <DetailSection title={copy.detail.risks} items={detail.risks} />
      <DetailSection title={copy.detail.recommendations} items={detail.recommendations} />
      <DetailSection title={copy.detail.modelsUsed} items={detail.modelsUsed} />
      <DetailSection title={copy.detail.toolsUsed} items={detail.toolsUsed} />
      <DetailSection title={copy.detail.consultations} items={detail.consultations} />

      {detail.links.length > 0 ? (
        <section className="acMobileReportDetailSection">
          <h3 className="acMobileReportDetailSectionTitle">{copy.detail.links}</h3>
          <ul className="acMobileReportDetailLinks">
            {detail.links.map((link) => (
              <li key={`${link.href}-${link.label}`}>
                <Link to={link.href} className="acMobileLinkBtn">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
