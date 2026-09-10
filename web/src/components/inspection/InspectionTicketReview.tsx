import type * as api from '../../lib/api'
import { inspectionItemStatusLabel, inspectionTicketUrgencyLabel } from '../../lib/inspectionPresentation'

type InspectionTicketReviewProps = {
  checkpointTitle: string
  location: { name: string; city?: string | null }
  equipment?: { name: string; type?: string | null } | null
  categoryName: string
  status: 'ISSUE' | 'CRITICAL'
  description?: string | null
  attachments: api.InspectionRunItemAttachment[]
  pendingAttachmentCount?: number
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function InspectionTicketReview({
  checkpointTitle,
  location,
  equipment,
  categoryName,
  status,
  description,
  attachments,
  pendingAttachmentCount = 0,
  busy,
  onConfirm,
  onCancel,
}: InspectionTicketReviewProps) {
  const urgent = status === 'CRITICAL'

  return (
    <section
      className={`inspectionTicketReview${urgent ? ' inspectionTicketReview--urgent' : ''}`}
      aria-label="Проверка заявки перед созданием"
    >
      <div className="inspectionTicketReviewHeader">
        <div>
          <div className="inspectionTicketReviewEyebrow">Проверьте заявку</div>
          <div className="inspectionTicketReviewTitle">{inspectionTicketUrgencyLabel(status)}</div>
        </div>
        <span className="inspectionTicketReviewStatus">{inspectionItemStatusLabel(status)}</span>
      </div>

      <dl className="inspectionTicketReviewGrid">
        <div>
          <dt>Пункт обхода</dt>
          <dd>{checkpointTitle}</dd>
        </div>
        <div>
          <dt>Локация</dt>
          <dd>{location.name}{location.city ? ` · ${location.city}` : ''}</dd>
        </div>
        {equipment ? (
          <div>
            <dt>Оборудование</dt>
            <dd>{equipment.name}{equipment.type ? ` · ${equipment.type}` : ''}</dd>
          </div>
        ) : null}
        <div>
          <dt>Категория</dt>
          <dd>{categoryName}</dd>
        </div>
        <div>
          <dt>Описание</dt>
          <dd>{description?.trim() || 'Без дополнительного комментария'}</dd>
        </div>
        <div>
          <dt>Фото</dt>
          <dd>{attachments.length + pendingAttachmentCount > 0 ? `Добавлено: ${attachments.length + pendingAttachmentCount}` : 'Не добавлено'}</dd>
        </div>
      </dl>

      <div className="inspectionTicketReviewActions">
        <button type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Создаём заявку…' : 'Создать заявку'}
        </button>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </section>
  )
}
