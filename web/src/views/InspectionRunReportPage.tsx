import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { ProtectedUploadThumbLink } from '../ui/ProtectedUploadMedia'

const REVIEW_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('ru-RU')
  } catch {
    return value
  }
}

function performerLabel(user?: { firstName?: string | null; lastName?: string | null; email: string } | null) {
  if (!user) return '—'
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  return fullName || user.email
}

function itemStatusLabel(status: api.InspectionRunItemStatus) {
  if (status === 'PENDING') return 'Не заполнено'
  if (status === 'OK') return 'OK'
  if (status === 'ISSUE') return 'Проблема'
  if (status === 'CRITICAL') return 'Критично'
  if (status === 'SKIPPED') return 'Пропущено'
  return status
}

function reportStatusLabel(status: api.InspectionReportStatus) {
  if (status === 'DRAFT') return 'Черновик'
  if (status === 'SUBMITTED') return 'Отправлен на подтверждение'
  if (status === 'APPROVED') return 'Подтверждено'
  if (status === 'REJECTED') return 'Возвращено'
  return status
}

export function InspectionRunReportPage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [reviewComment, setReviewComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const reportQ = useQuery({
    queryKey: ['inspection-run-report', id],
    queryFn: () => api.getInspectionRunReport(id),
    enabled: !!id,
  })
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const report = reportQ.data
  const reportMeta = report?.reportMeta
  const canReview = REVIEW_ROLES.includes((meQ.data?.role || '') as api.Role)
  const canSubmit = !!report && report.run.status === 'COMPLETED' && (reportMeta?.status === 'DRAFT' || reportMeta?.status === 'REJECTED')
  const canActOnSubmitted = !!report && reportMeta?.status === 'SUBMITTED' && canReview
  const isApproved = reportMeta?.status === 'APPROVED'
  const isRejected = reportMeta?.status === 'REJECTED'

  const submitM = useMutation({
    mutationFn: () => api.submitInspectionRunReport(id),
    onSuccess: async (next) => {
      setActionError(null)
      queryClient.setQueryData(['inspection-run-report', id], next)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspection-run-report', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspection-run', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspection-runs'] }),
      ])
    },
    onError: (error: any) => setActionError(error?.message || String(error)),
  })

  const reviewM = useMutation({
    mutationFn: (input: api.ReviewInspectionRunReportInput) => api.reviewInspectionRunReport(id, input),
    onSuccess: async (next) => {
      setActionError(null)
      queryClient.setQueryData(['inspection-run-report', id], next)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspection-run-report', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspection-run', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspection-runs'] }),
      ])
    },
    onError: (error: any) => setActionError(error?.message || String(error)),
  })

  const statusTone = useMemo(() => {
    if (!reportMeta) return '#4b5563'
    if (reportMeta.status === 'APPROVED') return '#166534'
    if (reportMeta.status === 'REJECTED') return '#991b1b'
    if (reportMeta.status === 'SUBMITTED') return '#92400e'
    return '#374151'
  }, [reportMeta])

  function handleApprove() {
    reviewM.mutate({ decision: 'APPROVED', comment: reviewComment.trim() || undefined })
  }

  function handleReject() {
    if (!reviewComment.trim()) {
      setActionError('Добавьте комментарий, чтобы вернуть акт на доработку')
      return
    }

    reviewM.mutate({ decision: 'REJECTED', comment: reviewComment.trim() })
  }

  if (reportQ.isLoading) {
    return <div className="panel"><div className="muted">Загружаем акт…</div></div>
  }

  if (reportQ.isError || !report) {
    return <div className="alert">{(reportQ.error as any)?.message || 'Не удалось загрузить акт'}</div>
  }

  return (
    <div className="inspectionReportPage">
      <div className="row no-print">
        <div>
          <h2 style={{ marginBottom: 4 }}>Акт выполненных работ</h2>
          <div className="muted small">Печатная версия клиентского документа по completed inspection run.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/inspection/runs/${id}`}><button className="ghost">Назад к обходу</button></Link>
          <Link to="/inspection/runs"><button className="ghost">История обходов</button></Link>
          <button type="button" onClick={() => window.print()}>Печать / PDF</button>
        </div>
      </div>

      {actionError ? <div className="alert no-print">{actionError}</div> : null}

      <div className="workActPrintRoot">
        <section className="panel workActSheet">
          <header className="workActDocHeader">
            <div className="workActBrandRow">
              {report.document.executorCompany.logoUrl ? (
                <img
                  src={api.resolveFileUrl(report.document.executorCompany.logoUrl)}
                  alt={report.document.executorCompany.name}
                  className="workActLogo"
                />
              ) : null}
              <div>
                <div className="workActEyebrow">Сервис Менеджер</div>
                <h1 className="workActTitle">{report.document.title}</h1>
                <div className="muted small">№ {report.document.number} от {fmtDate(report.document.date)}</div>
              </div>
            </div>
            <div className="workActStatusBlock">
              <span className="tag" style={{ color: statusTone, borderColor: statusTone }}>{reportStatusLabel(report.reportMeta.status)}</span>
              <div className="muted small" style={{ marginTop: 8 }}>
                Начат: {fmtDateTime(report.run.startedAt)}
                <br />
                Завершен: {fmtDateTime(report.run.completedAt)}
                <br />
                Подтвержден: {fmtDateTime(report.reportMeta.approvedAt)}
              </div>
            </div>
          </header>

          <section className="workActPartyGrid">
            <div className="workActPartyCard">
              <div className="muted small">Исполнитель</div>
              <div className="workActStrong">{report.document.executorCompany.name}</div>
              <div className="muted small">{report.document.executorCompany.legalName || '—'}</div>
              <div className="muted small">{report.document.executorCompany.address || '—'}</div>
              <div className="muted small">Тел.: {report.document.executorCompany.phone || '—'}</div>
              <div className="muted small">Email: {report.document.executorCompany.email || '—'}</div>
              <div className="muted small">ИНН: {report.document.executorCompany.taxId || '—'}</div>
              <div className="muted small">Рег. номер: {report.document.executorCompany.registrationNumber || '—'}</div>
            </div>
            <div className="workActPartyCard">
              <div className="muted small">Заказчик</div>
              <div className="workActStrong">{report.document.clientCompany.name}</div>
              <div className="muted small">{report.document.clientCompany.legalName || '—'}</div>
              <div className="muted small">{report.document.clientCompany.address || '—'}</div>
              <div className="muted small">Тел.: {report.document.clientCompany.phone || '—'}</div>
              <div className="muted small">Email: {report.document.clientCompany.email || '—'}</div>
            </div>
          </section>

          <section className="workActMetaGrid">
            <div className="workActMetaCard">
              <div className="muted small">Локация</div>
              <div className="workActStrong">{report.run.location.name}</div>
              <div className="muted small">{report.run.location.platformCode || '—'}{report.run.location.city ? ` · ${report.run.location.city}` : ''}</div>
              <div className="muted small">{report.run.location.address || '—'}</div>
            </div>
            <div className="workActMetaCard">
              <div className="muted small">Оборудование</div>
              <div className="workActStrong">{report.run.equipment?.name || '—'}</div>
              <div className="muted small">{report.run.equipment?.type || '—'}</div>
            </div>
            <div className="workActMetaCard">
              <div className="muted small">Исполнитель обхода</div>
              <div className="workActStrong">{performerLabel(report.run.performedBy)}</div>
              <div className="muted small">{report.run.performedBy?.email || '—'}</div>
            </div>
            <div className="workActMetaCard">
              <div className="muted small">Шаблон</div>
              <div className="workActStrong">{report.run.template.name}</div>
              <div className="muted small">ID обхода: {report.run.id}</div>
            </div>
          </section>

          <section className="panel workActSummaryPanel">
            <h3 style={{ marginBottom: 10 }}>Сводка</h3>
            <div className="workActSummaryGrid">
              <div><div className="muted small">Всего пунктов</div><div className="workActMetric">{report.summary.totalItems}</div></div>
              <div><div className="muted small">OK</div><div className="workActMetric">{report.summary.okCount}</div></div>
              <div><div className="muted small">Проблемы</div><div className="workActMetric">{report.summary.issueCount}</div></div>
              <div><div className="muted small">Критично</div><div className="workActMetric">{report.summary.criticalCount}</div></div>
              <div><div className="muted small">Пропущено</div><div className="workActMetric">{report.summary.skippedCount || 0}</div></div>
              <div><div className="muted small">Нужен ремонт</div><div className="workActMetric">{report.summary.repairRequiredCount}</div></div>
              <div><div className="muted small">Создано заявок</div><div className="workActMetric">{report.summary.createdTicketsCount}</div></div>
            </div>
          </section>

          <section className="panel no-print" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Подтверждение акта</h3>

            {canSubmit ? (
              <div className="row" style={{ alignItems: 'center', marginBottom: 0 }}>
                <div className="muted small">
                  {report.reportMeta.status === 'REJECTED'
                    ? 'Акт был возвращен. После исправлений его можно отправить повторно.'
                    : 'Completed run можно отправить на подтверждение.'}
                </div>
                <button type="button" onClick={() => submitM.mutate()} disabled={submitM.isPending || reviewM.isPending}>
                  {submitM.isPending ? 'Отправляем…' : report.reportMeta.status === 'REJECTED' ? 'Отправить повторно' : 'Отправить на подтверждение'}
                </button>
              </div>
            ) : null}

            {report.reportMeta.status === 'SUBMITTED' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="muted small">
                  Акт отправлен на подтверждение. {canReview ? 'Вы можете подтвердить его или вернуть с комментарием.' : 'Ожидается проверка ответственным сотрудником.'}
                </div>
                <label>
                  Комментарий проверки
                  <textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Комментарий для подтверждения или возврата"
                    disabled={!canActOnSubmitted || reviewM.isPending}
                  />
                </label>
                {canActOnSubmitted ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleApprove} disabled={reviewM.isPending}>{reviewM.isPending ? 'Сохраняем…' : 'Подтвердить'}</button>
                    <button type="button" className="ghost" onClick={handleReject} disabled={reviewM.isPending}>Вернуть</button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isApproved ? <div className="muted small">Акт подтвержден: {performerLabel(report.reportMeta.reviewedBy)} · {fmtDateTime(report.reportMeta.approvedAt)}</div> : null}
            {isRejected ? <div className="muted small">Акт возвращен: {performerLabel(report.reportMeta.reviewedBy)} · {fmtDateTime(report.reportMeta.reviewedAt)}{report.reportMeta.reviewComment ? ` · ${report.reportMeta.reviewComment}` : ''}</div> : null}
          </section>

          <section className="panel workActTablePanel">
            <h3 style={{ marginBottom: 10 }}>Пункты обхода</h3>
            <div className="workActTableWrap">
              <table className="workActTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Пункт</th>
                    <th>Статус</th>
                    <th>Комментарий</th>
                    <th>Фото</th>
                    <th>Связанные заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="workActStrong">{item.title}</div>
                        {item.description ? <div className="muted small">{item.description}</div> : null}
                        {item.requiresRepair ? <div className="small" style={{ marginTop: 4 }}>Требуется ремонт</div> : null}
                      </td>
                      <td>{itemStatusLabel(item.status)}</td>
                      <td>{item.comment || '—'}</td>
                      <td>
                        {item.attachments.length ? (
                          <div className="workActAttachmentGrid">
                            {item.attachments.map((attachment) => (
                              <ProtectedUploadThumbLink
                                key={attachment.id}
                                url={api.resolveInspectionAttachmentUrl(attachment)}
                                alt={attachment.originalName || 'inspection attachment'}
                                className="workActAttachmentLink"
                                imgClassName="workActAttachmentImage"
                              />
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {item.ticket ? (
                          <div>
                            <div className="workActStrong">{item.ticket.status}</div>
                            <div className="muted small">{item.ticket.problemText || 'Без описания'}</div>
                            <div className="no-print" style={{ marginTop: 8 }}>
                              <Link to={`/tickets/${item.ticket.id}`}><button className="ghost">Открыть ticket</button></Link>
                            </div>
                            <div className="print-ticket-ref">Ticket #{item.ticket.id}</div>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel workActSignaturePanel">
            <h3 style={{ marginBottom: 14 }}>Подписи</h3>
            <div className="workActSignatureGrid">
              <div className="workActSignatureLine">
                <div className="muted small">Исполнитель</div>
                <div className="workActStrong">{report.document.executorCompany.signatureLineName || performerLabel(report.run.performedBy)}</div>
                <div className="muted small">{report.document.executorCompany.signatureLineTitle || 'Исполнитель работ'}</div>
                <div className="workActSignatureRule" />
                <div className="muted small">Дата / подпись</div>
              </div>
              <div className="workActSignatureLine">
                <div className="muted small">Проверил</div>
                <div className="workActStrong">{performerLabel(report.reportMeta.reviewedBy)}</div>
                <div className="muted small">{isApproved ? 'Акт подтвержден' : 'Проверка акта'}</div>
                <div className="workActSignatureRule" />
                <div className="muted small">Дата / подпись</div>
              </div>
              <div className="workActSignatureLine">
                <div className="muted small">Представитель клиента</div>
                <div className="workActStrong">{report.document.clientCompany.signatureLineName || '________________'}</div>
                <div className="muted small">{report.document.clientCompany.signatureLineTitle || 'Представитель заказчика'}</div>
                <div className="workActSignatureRule" />
                <div className="muted small">Дата / подпись</div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  )
}
