import { TicketAttachments } from '../../views/ticket-page/TicketAttachments'
import type * as api from '../../lib/api'

type Props = {
  loading: boolean
  isError: boolean
  error?: unknown
  requestAttachments: api.TicketAttachmentItem[]
  workReportAttachments: api.TicketAttachmentItem[]
  canDeletePhoto: boolean
  deletePending: boolean
  onDelete: (attachmentId: string) => void
  deleteAttachmentError?: string | null
  fmt: (dt?: string | null) => string
  fmtBytes: (v?: number | null) => string
}

export function TicketPhotosPanel({
  loading,
  isError,
  error,
  requestAttachments,
  workReportAttachments,
  canDeletePhoto,
  deletePending,
  onDelete,
  deleteAttachmentError,
  fmt,
  fmtBytes,
}: Props) {
  return (
    <>
      <TicketAttachments
        title="Фото заявки"
        emptyText="Нет фото заявки"
        loading={loading}
        isError={isError}
        error={error}
        data={requestAttachments}
        canDeletePhoto={canDeletePhoto}
        deletePending={deletePending}
        onDelete={onDelete}
        deleteAttachmentError={deleteAttachmentError}
        fmt={fmt}
        fmtBytes={fmtBytes}
      />

      <TicketAttachments
        title="Отчёт техника"
        emptyText="Нет фото отчёта"
        loading={loading}
        isError={isError}
        error={error}
        data={workReportAttachments}
        canDeletePhoto={canDeletePhoto}
        deletePending={deletePending}
        onDelete={onDelete}
        deleteAttachmentError={deleteAttachmentError}
        fmt={fmt}
        fmtBytes={fmtBytes}
      />
    </>
  )
}
