import { useEffect, useId, useRef, useState } from 'react'

import {
  clearIds,
  personSearchText,
  rowsMatchingQuery,
  selectAllIds,
  selectedIds,
  selectionCountLabel,
  ticketSearchText,
  toggleId,
  type IdSelection,
  type TechnicianMapMode,
  type TechnicianMapPersonRow,
  type TechnicianMapTicketRow,
} from './technicianMapSelection'
import './technicianMapFilters.css'

type Props = {
  surface: 'desktop' | 'mobile'
  mode: TechnicianMapMode
  query: string
  technicianIds: IdSelection
  ticketIds: IdSelection
  people: TechnicianMapPersonRow[]
  tickets: TechnicianMapTicketRow[]
  onMode: (mode: TechnicianMapMode) => void
  onQuery: (query: string) => void
  onTechnicianIds: (next: IdSelection) => void
  onTicketIds: (next: IdSelection) => void
}

function personLabel(person: TechnicianMapPersonRow): string {
  const name = `${person.lastName || ''} ${person.firstName || ''}`.trim()
  return name || person.id
}

function ticketLabel(ticket: TechnicianMapTicketRow): string {
  return `#${ticket.ticketNumber} ${ticket.title}`
}

export function TechnicianMapFilters({
  surface,
  mode,
  query,
  technicianIds,
  ticketIds,
  people,
  tickets,
  onMode,
  onQuery,
  onTechnicianIds,
  onTicketIds,
}: Props) {
  const shellClass = surface === 'mobile' ? 'mobileCard mobileForm technician-map-filters' : 'panel technician-map-filters'
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const peopleIds = people.map((person) => person.id)
  const ticketIdsAll = tickets.map((ticket) => ticket.id)
  const activeSelection = mode === 'technicians' ? technicianIds : ticketIds
  const activeIds = mode === 'technicians' ? peopleIds : ticketIdsAll
  const count = selectionCountLabel(activeSelection, activeIds)
  const chosenIds = selectedIds(activeSelection, activeIds)
  const chosen = new Set(chosenIds)
  const visiblePeople = rowsMatchingQuery(people, query, personSearchText)
  const visibleTickets = rowsMatchingQuery(tickets, query, ticketSearchText)
  const summary = fieldSummary(mode, count, people, tickets, chosen)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const changeMode = (next: TechnicianMapMode) => {
    setOpen(false)
    onMode(next)
  }

  return (
    <div className={shellClass}>
      <div className="technician-map-filters-modes">
        <button
          type="button"
          className={mode === 'technicians' ? undefined : 'ghost'}
          aria-pressed={mode === 'technicians'}
          onClick={() => changeMode('technicians')}
        >
          По техникам
        </button>
        <button
          type="button"
          className={mode === 'tickets' ? undefined : 'ghost'}
          aria-pressed={mode === 'tickets'}
          onClick={() => changeMode('tickets')}
        >
          По заявкам
        </button>
      </div>
      <div className="technician-map-filters-row">
        <div className="technician-map-filters-picker" ref={pickerRef}>
          <button
            type="button"
            className="technician-map-filters-trigger"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="technician-map-filters-trigger-text">{summary}</span>
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
          {open ? (
            <div className="technician-map-filters-menu" id={listId}>
              <input
                ref={searchRef}
                className="technician-map-filters-search"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder={mode === 'technicians' ? 'Имя, фамилия или ID' : 'Номер, ID или заголовок'}
              />
              <div className="technician-map-filters-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => (mode === 'technicians' ? onTechnicianIds(selectAllIds()) : onTicketIds(selectAllIds()))}
                >
                  Выбрать всех
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => (mode === 'technicians' ? onTechnicianIds(clearIds()) : onTicketIds(clearIds()))}
                >
                  Убрать всех
                </button>
              </div>
              <div className="technician-map-filters-list">
                {mode === 'technicians'
                  ? visiblePeople.length
                    ? visiblePeople.map((person) => (
                      <label key={person.id} className="technician-map-filters-option">
                        <input
                          type="checkbox"
                          checked={chosen.has(person.id)}
                          onChange={() => onTechnicianIds(toggleId(technicianIds, person.id, peopleIds))}
                        />
                        <span>{personLabel(person)}</span>
                      </label>
                    ))
                    : <div className="technician-map-filters-empty">Ничего не найдено</div>
                  : visibleTickets.length
                    ? visibleTickets.map((ticket) => (
                      <label key={ticket.id} className="technician-map-filters-option">
                        <input
                          type="checkbox"
                          checked={chosen.has(ticket.id)}
                          onChange={() => onTicketIds(toggleId(ticketIds, ticket.id, ticketIdsAll))}
                        />
                        <span>{ticketLabel(ticket)}</span>
                      </label>
                    ))
                    : <div className="technician-map-filters-empty">Ничего не найдено</div>}
              </div>
            </div>
          ) : null}
        </div>
        <div className="technician-map-filters-count">{count}</div>
      </div>
    </div>
  )
}

function fieldSummary(
  mode: TechnicianMapMode,
  count: string,
  people: TechnicianMapPersonRow[],
  tickets: TechnicianMapTicketRow[],
  chosen: Set<string>,
): string {
  if (count === 'ВСЕ') return mode === 'technicians' ? 'Все техники' : 'Все заявки'
  if (count === '0') return mode === 'technicians' ? 'Техники не выбраны' : 'Заявки не выбраны'
  if (mode === 'technicians') {
    return people.filter((person) => chosen.has(person.id)).map(personLabel).join(', ')
  }
  return tickets.filter((ticket) => chosen.has(ticket.id)).map(ticketLabel).join(', ')
}
