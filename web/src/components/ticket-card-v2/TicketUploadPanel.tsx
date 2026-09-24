import type { ChangeEvent, RefObject } from 'react'
import { TICKET_MEDIA_ACCEPT } from '../../lib/ticketAttachmentMedia'

export type TicketUploadPanelProps = {
  inputRef: RefObject<HTMLInputElement | null>
  selectedFile: File | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadClick: () => void
  pending: boolean
  helperText: string
  errorMessage?: string | null
}

function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <div className="alert" style={{ marginTop: 10 }}>{message}</div>
}

export function TicketUploadPanel({
  inputRef,
  selectedFile,
  onFileChange,
  onUploadClick,
  pending,
  helperText,
  errorMessage,
}: TicketUploadPanelProps) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Фото или видео</h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept={TICKET_MEDIA_ACCEPT} onChange={onFileChange} disabled={pending} />
        <button onClick={onUploadClick} disabled={pending}>
          {pending ? 'Загружаем…' : selectedFile ? 'Загрузить файл' : 'Выбрать файл'}
        </button>
        <div className="muted small">{helperText}</div>
      </div>
      <InlineError message={errorMessage} />
    </div>
  )
}
