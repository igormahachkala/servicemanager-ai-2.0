export type IdSelection = 'all' | string[]

export type TechnicianMapMode = 'technicians' | 'tickets'

export type TechnicianMapSelection = {
  mode: TechnicianMapMode
  technicianIds: IdSelection
  ticketIds: IdSelection
  technicianMemory: IdSelection
  ticketMemory: IdSelection
}

export type TechnicianMapPersonRow = {
  id: string
  firstName: string | null
  lastName: string | null
  latitude: number | null
  longitude: number | null
  syncedAtLabel: string
  shiftOpen: boolean
}

export type TechnicianMapTicketRow = {
  id: string
  ticketNumber: number
  title: string
  technicianId: string
}

export function initialTechnicianMapSelection(): TechnicianMapSelection {
  return {
    mode: 'technicians',
    technicianIds: 'all',
    ticketIds: 'all',
    technicianMemory: 'all',
    ticketMemory: 'all',
  }
}

export function switchTechnicianMapMode(
  state: TechnicianMapSelection,
  next: TechnicianMapMode,
): TechnicianMapSelection {
  if (next === state.mode) return state
  if (next === 'tickets') {
    return {
      mode: 'tickets',
      technicianMemory: state.technicianIds,
      technicianIds: 'all',
      ticketIds: state.ticketMemory,
      ticketMemory: state.ticketMemory,
    }
  }
  return {
    mode: 'technicians',
    ticketMemory: state.ticketIds,
    ticketIds: 'all',
    technicianIds: state.technicianMemory,
    technicianMemory: state.technicianMemory,
  }
}

export function selectedIds(selection: IdSelection, allIds: string[]): string[] {
  if (selection === 'all') return allIds
  const known = new Set(allIds)
  return selection.filter((id) => known.has(id))
}

export function selectionCountLabel(selection: IdSelection, allIds: string[]): string {
  const chosen = selectedIds(selection, allIds)
  if (allIds.length > 0 && chosen.length === allIds.length) return 'ВСЕ'
  if (allIds.length === 0 && selection === 'all') return 'ВСЕ'
  return String(chosen.length)
}

export function selectAllIds(): IdSelection {
  return 'all'
}

export function clearIds(): IdSelection {
  return []
}

export function toggleId(selection: IdSelection, id: string, allIds: string[]): IdSelection {
  const chosen = new Set(selectedIds(selection, allIds))
  if (chosen.has(id)) chosen.delete(id)
  else chosen.add(id)
  if (allIds.length > 0 && chosen.size === allIds.length) return 'all'
  return allIds.filter((item) => chosen.has(item))
}

export function personSearchText(person: TechnicianMapPersonRow): string {
  return `${person.firstName || ''} ${person.lastName || ''} ${person.id}`.toLocaleLowerCase('ru')
}

export function ticketSearchText(ticket: TechnicianMapTicketRow): string {
  return `${ticket.ticketNumber} ${ticket.id} ${ticket.title}`.toLocaleLowerCase('ru')
}

export function rowsMatchingQuery<T>(rows: T[], query: string, textOf: (row: T) => string): T[] {
  const needle = query.trim().toLocaleLowerCase('ru')
  if (!needle) return rows
  return rows.filter((row) => textOf(row).includes(needle))
}

export function personDisplayName(person: TechnicianMapPersonRow): string {
  const name = [person.firstName, person.lastName].filter((part) => part && part.trim()).join(' ')
  return name || person.id
}

export function markerPeople(
  state: TechnicianMapSelection,
  people: TechnicianMapPersonRow[],
  tickets: TechnicianMapTicketRow[],
): TechnicianMapPersonRow[] {
  const withPoint = people.filter((person) => person.latitude != null && person.longitude != null)
  if (state.mode === 'technicians') {
    const chosen = new Set(selectedIds(state.technicianIds, people.map((person) => person.id)))
    return withPoint.filter((person) => chosen.has(person.id))
  }
  const chosenTickets = new Set(selectedIds(state.ticketIds, tickets.map((ticket) => ticket.id)))
  const technicianIds = new Set(
    tickets.filter((ticket) => chosenTickets.has(ticket.id)).map((ticket) => ticket.technicianId),
  )
  return withPoint.filter((person) => technicianIds.has(person.id))
}
