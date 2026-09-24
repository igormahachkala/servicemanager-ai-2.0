import type * as api from '../../lib/api'

export type TicketChildCreateFormProps = {
  categoryId: string
  onCategoryChange: (value: string) => void
  problemText: string
  onProblemTextChange: (value: string) => void
  urgency: api.TicketUrgency
  onUrgencyChange: (value: api.TicketUrgency) => void
  categories: Array<{ id: string; name: string; isActive?: boolean | null }>
  pending: boolean
  canSubmit: boolean
  onSubmit: () => void
  onCancel: () => void
  errorMessage?: string | null
}

function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <div className="alert" style={{ marginTop: 10 }}>{message}</div>
}

export function TicketChildCreateForm({
  categoryId,
  onCategoryChange,
  problemText,
  onProblemTextChange,
  urgency,
  onUrgencyChange,
  categories,
  pending,
  canSubmit,
  onSubmit,
  onCancel,
  errorMessage,
}: TicketChildCreateFormProps) {
  return (
    <div className="panel uiCard" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Новая дополнительная работа</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Локация и контакт наследуются от текущей заявки. Для MVP фото в child-ticket не прикрепляется на этапе создания.
      </div>
      <div className="form">
        <label>
          Категория *
          <select
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            disabled={pending}
          >
            <option value="">Выберите категорию</option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label>
          Описание проблемы *
          <textarea
            value={problemText}
            onChange={(e) => onProblemTextChange(e.target.value)}
            rows={4}
            disabled={pending}
            placeholder="Кратко опишите дополнительную работу"
          />
        </label>
        <label>
          Срочность
          <select
            value={urgency}
            onChange={(e) => onUrgencyChange(e.target.value as api.TicketUrgency)}
            disabled={pending}
          >
            <option value="NOT_URGENT">Не срочно</option>
            <option value="URGENT">Срочно</option>
          </select>
          <div className="fieldHint">Для доп. работы выберите срочность отдельно от родительской заявки.</div>
        </label>
        <div className="uiActions">
          <button onClick={onSubmit} disabled={!canSubmit}>
            {pending ? 'Создаём…' : 'Создать доп. работу'}
          </button>
          <button
            className="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Отмена
          </button>
        </div>
      </div>
      <InlineError message={errorMessage} />
    </div>
  )
}
