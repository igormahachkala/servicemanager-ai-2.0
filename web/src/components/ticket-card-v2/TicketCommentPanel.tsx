export type TicketCommentPanelProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  pending: boolean
  canSubmit: boolean
}

export function TicketCommentPanel({ value, onChange, onSubmit, pending, canSubmit }: TicketCommentPanelProps) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Комментарий</h3>
      <div className="form">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Добавьте комментарий по выполненным действиям"
          disabled={pending}
        />
        <div className="uiActions">
          <button onClick={onSubmit} disabled={!canSubmit}>
            {pending ? 'Сохраняем…' : 'Добавить комментарий'}
          </button>
        </div>
      </div>
    </div>
  )
}
