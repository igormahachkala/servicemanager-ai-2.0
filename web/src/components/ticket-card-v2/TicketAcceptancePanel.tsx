import type { ChangeEvent, RefObject } from 'react'

export type TicketAcceptancePanelProps = {
  comment: string
  onCommentChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  pending: boolean
  canReject: boolean
  onAccept: () => void
  onReject: () => void
  errorMessage?: string | null
}

function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <div className="alert" style={{ marginTop: 10 }}>{message}</div>
}

export function TicketAcceptancePanel({
  comment,
  onCommentChange,
  inputRef,
  onFileChange,
  pending,
  canReject,
  onAccept,
  onReject,
  errorMessage,
}: TicketAcceptancePanelProps) {
  return (
    <div className="panel uiCard" style={{ marginBottom: 12, borderColor: '#fdba74', background: '#fff7ed' }}>
      <h3 style={{ marginBottom: 8 }}>Приёмка работы</h3>
      <div className="muted small" style={{ marginBottom: 10, lineHeight: 1.5 }}>
        Техник отметил работу как завершённую. Проверьте результат и примите заявку либо верните её в работу с комментарием.
      </div>
      <div className="form">
        <label>
          Комментарий при отказе
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={3}
            placeholder="Объясните, что нужно исправить. Обязательно при отказе."
            disabled={pending}
          />
        </label>
        <label>
          Фото при отказе / приёмке (необязательно)
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={pending}
          />
          <div className="muted small" style={{ marginTop: 6 }}>
            Можно приложить фото результата. При приёмке фото не обязательно.
          </div>
        </label>
        <div className="uiActions">
          <button
            onClick={onAccept}
            disabled={pending}
          >
            {pending ? 'Сохраняем…' : 'Принять работу'}
          </button>
          <button
            className="ghost"
            onClick={onReject}
            disabled={!canReject}
            title={!canReject ? 'Комментарий обязателен при отказе' : undefined}
          >
            {pending ? 'Сохраняем…' : 'Не принять работу'}
          </button>
        </div>
      </div>
      <InlineError message={errorMessage} />
    </div>
  )
}
