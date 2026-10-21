import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { useLinkedBoardScope } from '../hooks/useLinkedBoardScope'
import { archiveStatusLabel, archiveTicketCount, selectArchiveColumns } from '../lib/ticketArchive'
import { compactTicketAssigneeLabel } from '../lib/ticketActorIdentity'

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function compactServiceContext(ticket: api.TicketCard) {
  const locationText = [ticket.location?.name, ticket.location?.city].filter(Boolean).join(' · ')
  const equipmentText = [ticket.equipment?.name, ticket.equipment?.type].filter(Boolean).join(' · ')
  if (locationText && equipmentText) return `${locationText} · ${equipmentText}`
  if (locationText) return locationText
  if (equipmentText) return equipmentText
  return ticket.pointName || ''
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * SMA-019 — Archive V1 (minimal).
 * Показывает только завершённые (DONE) и отменённые (CANCELED) заявки.
 * Переиспользует board endpoint и его visibility-логику (через useLinkedBoardScope),
 * includeArchived=true — чтобы показывать в т.ч. давно закрытые заявки.
 * Активную доску (/board) не меняем.
 */
export function ArchivePage() {
  const { me, observerCompanyId, linkedClientCompanyId, boardParams, ticketScope } = useLinkedBoardScope()
  const [take, setTake] = useState(200)

  const boardQ = useQuery({
    queryKey: ['archive-board', { take, observerCompanyId, linkedClientCompanyId }],
    queryFn: () =>
      api.board({
        take,
        linkedClientCompanyId: boardParams.linkedClientCompanyId,
        companyId: boardParams.companyId,
        includeArchived: true,
      }),
  })

  const archiveColumns = useMemo(() => selectArchiveColumns(boardQ.data), [boardQ.data])
  const totalArchived = useMemo(() => archiveTicketCount(boardQ.data), [boardQ.data])
  const isLoading = boardQ.isLoading || boardQ.isFetching
  const isEmpty = !isLoading && !boardQ.isError && !!boardQ.data && totalArchived === 0

  function buildTicketLink(ticket: api.TicketCard) {
    return api.appendScopeToPath(`/tickets/${ticket.id}`, ticketScope, me)
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Архив заявок</h2>
          <div className="muted small">
            {isLoading
              ? 'Загружаем архив…'
              : `Завершённые и отменённые заявки · всего: ${totalArchived}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={api.appendScopeToPath('/board', ticketScope, me)}>
            <button className="ghost">К активной доске</button>
          </Link>
          <button className="ghost" onClick={() => boardQ.refetch()} disabled={boardQ.isFetching}>
            Обновить
          </button>
        </div>
      </div>

      <div className="pageHint">
        Здесь хранятся закрытые заявки (статусы «Завершённые» и «Отменённые»). Активные заявки — на доске.
      </div>

      <div className="panel uiCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div className="muted small">Лимит выборки</div>
          <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            take
            <input
              style={{ width: '100%', maxWidth: 110, minWidth: 0 }}
              value={String(take)}
              onChange={(e) => setTake(Math.max(20, Math.min(1000, Number(e.target.value) || 0)))}
            />
          </label>
        </div>
      </div>

      {boardQ.isError ? (
        <div className="alert">{errorMessage(boardQ.error)}</div>
      ) : null}

      {isEmpty ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Архив пуст</h3>
          <div className="muted small">Закрытые и отменённые заявки появятся здесь после завершения работы.</div>
        </div>
      ) : null}

      <div className="kanban">
        {isLoading && !boardQ.data ? (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="muted small">Загружаем архив…</div>
          </div>
        ) : (
          archiveColumns.map((col) => (
            <div key={col.status} className="col">
              <div className="colhead">
                <div className="coltitle">{archiveStatusLabel(col.status)}</div>
                <div className="pill">{col.total}</div>
              </div>

              <div className="cards">
                {col.cards.map((ticket) => (
                  <div key={ticket.id} className="ticket">
                    <Link to={buildTicketLink(ticket)} style={{ textDecoration: 'none' }}>
                      <div className="ticketTitle">{ticket.title}</div>
                    </Link>
                    {compactServiceContext(ticket) ? (
                      <div className="muted small" style={{ marginTop: 4, marginBottom: 2 }}>
                        {compactServiceContext(ticket)}
                      </div>
                    ) : null}
                    <div className="ticketMeta">
                      {ticket.assignedTechnician ? (
                        <span className="tag">{compactTicketAssigneeLabel(ticket)}</span>
                      ) : (
                        <span className="tag">Не назначено</span>
                      )}
                    </div>
                    <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{fmt(ticket.createdAt)}</span>
                      <span title="Срок SLA">{ticket.slaDueAt ? `Срок: ${fmt(ticket.slaDueAt)}` : 'Срок: —'}</span>
                    </div>
                  </div>
                ))}
                {col.cards.length === 0 ? <div className="muted small">Нет заявок</div> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
