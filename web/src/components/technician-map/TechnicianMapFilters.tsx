import {
  clearIds,
  personSearchText,
  rowsMatchingQuery,
  selectAllIds,
  selectionCountLabel,
  ticketSearchText,
  toggleId,
  type IdSelection,
  type TechnicianMapMode,
  type TechnicianMapPersonRow,
  type TechnicianMapTicketRow,
} from './technicianMapSelection'

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
  const shellClass = surface === 'mobile' ? 'mobileCard mobileForm' : 'panel'
  const peopleIds = people.map((person) => person.id)
  const ticketIdsAll = tickets.map((ticket) => ticket.id)
  const activeSelection = mode === 'technicians' ? technicianIds : ticketIds
  const activeIds = mode === 'technicians' ? peopleIds : ticketIdsAll
  const count = selectionCountLabel(activeSelection, activeIds)
  const visiblePeople = rowsMatchingQuery(people, query, personSearchText)
  const visibleTickets = rowsMatchingQuery(tickets, query, ticketSearchText)
  const chosen = new Set(
    activeSelection === 'all' ? activeIds : activeSelection,
  )

  return (
    <div className={shellClass} style={{ marginBottom: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onMode('technicians')} disabled={mode === 'technicians'}>
          По техникам
        </button>
        <button type="button" onClick={() => onMode('tickets')} disabled={mode === 'tickets'}>
          По заявкам
        </button>
      </div>
      <label>
        {mode === 'technicians' ? 'Техники' : 'Заявки'}
        <span style={{ marginLeft: 8 }}>{count}</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={mode === 'technicians' ? 'Имя, фамилия или ID' : 'Номер, ID или заголовок'}
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => (mode === 'technicians' ? onTechnicianIds(selectAllIds()) : onTicketIds(selectAllIds()))}
        >
          Выбрать всех
        </button>
        <button
          type="button"
          onClick={() => (mode === 'technicians' ? onTechnicianIds(clearIds()) : onTicketIds(clearIds()))}
        >
          Убрать всех
        </button>
      </div>
      <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflow: 'auto' }}>
        {mode === 'technicians'
          ? visiblePeople.map((person) => (
            <label key={person.id}>
              <input
                type="checkbox"
                checked={chosen.has(person.id)}
                onChange={() => onTechnicianIds(toggleId(technicianIds, person.id, peopleIds))}
              />
              {` ${person.lastName || ''} ${person.firstName || ''}`.trim() || person.id}
            </label>
          ))
          : visibleTickets.map((ticket) => (
            <label key={ticket.id}>
              <input
                type="checkbox"
                checked={chosen.has(ticket.id)}
                onChange={() => onTicketIds(toggleId(ticketIds, ticket.id, ticketIdsAll))}
              />
              {` #${ticket.ticketNumber} ${ticket.title}`}
            </label>
          ))}
      </div>
    </div>
  )
}
