import type { ChangeEvent, RefObject } from 'react'

export type TicketUploadPanelProps = {
  inputRef: RefObject<HTMLInputElement | null>
  selectedFile: File | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadClick: () => void
  pending: boolean
  helperText: string
  errorMessage?: string | null
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
      <h3 style={{ marginBottom: 10 }}>Фото</h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} disabled={pending} />
        <button onClick={onUploadClick} disabled={pending}>
          {pending ? 'Загружаем…' : selectedFile ? 'Загрузить фото' : 'Выбрать фото'}
        </button>
        <div className="muted small">{helperText}</div>
      </div>
      {errorMessage ? <div className="alert" style={{ marginTop: 10 }}>{errorMessage}</div> : null}
    </div>
  )
}
