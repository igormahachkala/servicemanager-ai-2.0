import type { ReactNode } from 'react'
import type * as api from '../../lib/api'

type AssignmentCandidate = {
  id: string
  email: string
  matchedBy: string[]
}

type AssignmentData = {
  currentAssigneeId?: string | null
  matched: AssignmentCandidate[]
  others: AssignmentCandidate[]
  category: {
    name: string
  }
  requiredSpecializations: Array<{
    name: string
  }>
}

type SelectedCandidate = {
  email: string
  matched: boolean
  matchedBy: string[]
} | null

export type TicketAssignmentPanelProps = {
  ticket: api.TicketGetOne
  hasAssignedTechnician: boolean
  assignmentDecisionReason?: string | null
  showAssignmentEditor: boolean
  onToggleEditor: () => void
  loading: boolean
  isError: boolean
  errorMessage?: string | null
  assignmentData?: AssignmentData | null
  selectedTechnicianId: string
  onSelectedTechnicianChange: (value: string) => void
  assignPending: boolean
  onAssign: () => void
  assignError?: string | null
  selectedCandidate: SelectedCandidate
  selectedIsMatched: boolean
  selectedIsCurrent: boolean
  renderRecommendationBadge: (matched: boolean, matchedBy: string[]) => ReactNode
  renderTag: (content: ReactNode) => ReactNode
  renderLoading: () => ReactNode
  renderAssignError: (message?: string | null) => ReactNode
}

export function TicketAssignmentPanel({
  ticket,
  hasAssignedTechnician,
  assignmentDecisionReason,
  showAssignmentEditor,
  onToggleEditor,
  loading,
  isError,
  errorMessage,
  assignmentData,
  selectedTechnicianId,
  onSelectedTechnicianChange,
  assignPending,
  onAssign,
  assignError,
  selectedCandidate,
  selectedIsMatched,
  selectedIsCurrent,
  renderRecommendationBadge,
  renderTag,
  renderLoading,
  renderAssignError,
}: TicketAssignmentPanelProps) {
  return (
    <div className="panel uiCard" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Исполнитель</h3>
      <div className="uiCard" style={{ marginBottom: 10, padding: 10 }}>
        {hasAssignedTechnician ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div>
              <b>Ответственный:</b>{' '}
              {[ticket.assignedTechnician?.firstName, ticket.assignedTechnician?.lastName].filter(Boolean).join(' ') || ticket.assignedTechnician?.email}
            </div>
            {ticket.assignedTechnician?.phone ? <div className="muted small">{ticket.assignedTechnician.phone}</div> : null}
            <div className="muted small">Заявка закреплена за техником.</div>
            {assignmentDecisionReason ? (
              <div className="uiCard" style={{ padding: 10, marginTop: 6 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Назначение</div>
                <div className="muted small">
                  Исполнитель: {ticket.assignedTechnician?.email || '—'}
                </div>
                <div className="muted small">
                  Причина: {assignmentDecisionReason}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <div><b>Ответственный:</b> не назначен</div>
            <div className="muted small">Назначьте техника, чтобы зафиксировать ответственность по заявке.</div>
          </div>
        )}
        <div className="uiActions" style={{ marginTop: 8 }}>
          <button className="ghost" type="button" onClick={onToggleEditor}>
            {showAssignmentEditor ? 'Скрыть назначение' : hasAssignedTechnician ? 'Переназначить' : 'Назначить техника'}
          </button>
        </div>
      </div>
      {loading ? (
        renderLoading()
      ) : isError ? (
        <div className="alert">{errorMessage || 'Ошибка загрузки'}</div>
      ) : assignmentData && showAssignmentEditor ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {renderTag(`Текущий: ${ticket.assignedTechnician?.email || 'не назначен'}`)}
            {renderTag(`Подходящих: ${assignmentData.matched.length}`)}
          </div>
          <div className="uiActions" style={{ marginTop: 10 }}>
            <select
              value={selectedTechnicianId}
              onChange={(e) => onSelectedTechnicianChange(e.target.value)}
              style={{ width: '100%', maxWidth: 420, minWidth: 0 }}
            >
              <option value="">Выберите техника</option>
              {assignmentData.matched.length > 0 ? (
                <optgroup label="Подходящие техники">
                  {assignmentData.matched.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.email}{item.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}{item.matchedBy.length ? ` · подходит: ${item.matchedBy.join(', ')}` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {assignmentData.others.length > 0 ? (
                <optgroup label="Остальные техники">
                  {assignmentData.others.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.email}{item.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <button onClick={onAssign} disabled={assignPending || !selectedTechnicianId}>
              {assignPending ? 'Назначаем…' : 'Назначить'}
            </button>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="muted small" style={{ cursor: 'pointer' }}>Показать рекомендации по специализациям</summary>
            <div className="assignmentHintBox" style={{ marginTop: 8 }}>
              <div className="assignmentHintTitle">Рекомендация</div>
              <div className="muted small">Сначала показаны техники, которые подходят по специализациям категории. Ниже — остальные техники компании.</div>
              <div className="muted small" style={{ marginTop: 6 }}>
                Категория: {assignmentData.category.name} · Требуемые: {assignmentData.requiredSpecializations.length ? assignmentData.requiredSpecializations.map((item) => item.name).join(', ') : 'не заданы'}
              </div>
            </div>
          </details>
          {selectedCandidate ? (
            <div className="assignmentSelectedBox">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Выбранный техник</div>
              <div style={{ marginBottom: 6 }}>{selectedCandidate.email}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                {renderRecommendationBadge(selectedCandidate.matched, selectedCandidate.matchedBy)}
                {selectedIsCurrent ? <span className="uxBadge uxBadgeNeutral">Текущий исполнитель</span> : null}
              </div>
              {!selectedIsMatched ? <div className="assignmentWarning">Внимание: выбран техник, который не входит в рекомендованный список по специализациям категории.</div> : null}
            </div>
          ) : null}
          {renderAssignError(assignError)}
        </>
      ) : null}
      {!showAssignmentEditor && !loading && !isError ? (
        <div className="muted small">Блок назначения свернут для компактного просмотра.</div>
      ) : null}
    </div>
  )
}
