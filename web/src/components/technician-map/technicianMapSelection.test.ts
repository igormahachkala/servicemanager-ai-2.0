import { describe, expect, it } from 'vitest'

import {
  clearIds,
  initialTechnicianMapSelection,
  markerPeople,
  personSearchText,
  rowsMatchingQuery,
  selectionCountLabel,
  selectAllIds,
  switchTechnicianMapMode,
  ticketSearchText,
  toggleId,
  type TechnicianMapPersonRow,
  type TechnicianMapTicketRow,
} from './technicianMapSelection'

const people: TechnicianMapPersonRow[] = [
  { id: 'a', firstName: 'Иван', lastName: 'Петров', latitude: 1, longitude: 2, syncedAtLabel: '10.30 01:05', shiftOpen: true },
  { id: 'b', firstName: 'Олег', lastName: 'Сидоров', latitude: 3, longitude: 4, syncedAtLabel: '10.30 01:06', shiftOpen: true },
  { id: 'c', firstName: 'Мария', lastName: 'Беззаявки', latitude: 5, longitude: 6, syncedAtLabel: '10.30 01:07', shiftOpen: true },
  { id: 'd', firstName: 'Нина', lastName: 'Безточки', latitude: null, longitude: null, syncedAtLabel: '', shiftOpen: true },
]

const tickets: TechnicianMapTicketRow[] = [
  { id: 't1', ticketNumber: 1043, title: 'Течёт кран', technicianId: 'a' },
  { id: 't2', ticketNumber: 1044, title: 'Нет света', technicianId: 'b' },
]

describe('память фильтра карты техников', () => {
  it('по умолчанию выбраны все техники и счётчик ВСЕ', () => {
    const state = initialTechnicianMapSelection()
    expect(state.mode).toBe('technicians')
    expect(selectionCountLabel(state.technicianIds, people.map((person) => person.id))).toBe('ВСЕ')
  })

  it('поиск не меняет выбранный набор', () => {
    const selected = toggleId('all', 'c', people.map((person) => person.id))
    const visible = rowsMatchingQuery(people, 'петр', personSearchText)
    expect(visible.map((person) => person.id)).toEqual(['a'])
    expect(selected).toEqual(['a', 'b', 'd'])
    expect(rowsMatchingQuery(tickets, '1043', ticketSearchText).map((ticket) => ticket.id)).toEqual(['t1'])
  })

  it('возврат с заявок восстанавливает двух техников', () => {
    const two = toggleId(toggleId(clearIds(), 'a', ['a', 'b', 'c']), 'b', ['a', 'b', 'c'])
    const onTechnicians = { ...initialTechnicianMapSelection(), technicianIds: two }
    const onTickets = switchTechnicianMapMode(onTechnicians, 'tickets')
    expect(onTickets.technicianIds).toBe('all')
    expect(selectionCountLabel(onTickets.technicianIds, ['a', 'b', 'c'])).toBe('ВСЕ')
    const back = switchTechnicianMapMode(onTickets, 'technicians')
    expect(back.technicianIds).toEqual(['a', 'b'])
    expect(selectionCountLabel(back.technicianIds, ['a', 'b', 'c'])).toBe('2')
  })

  it('возврат с техников восстанавливает выбранные заявки', () => {
    const oneTicket = toggleId(clearIds(), 't1', ['t1', 't2'])
    const onTickets = switchTechnicianMapMode(
      { ...initialTechnicianMapSelection(), ticketMemory: oneTicket },
      'tickets',
    )
    expect(onTickets.ticketIds).toEqual(['t1'])
    const away = switchTechnicianMapMode(onTickets, 'technicians')
    expect(away.ticketIds).toBe('all')
    const back = switchTechnicianMapMode(away, 'tickets')
    expect(back.ticketIds).toEqual(['t1'])
  })

  it('в режиме техников показывает выбранного без заявки, в режиме заявок его нет', () => {
    const onlyBare = toggleId(clearIds(), 'c', people.map((person) => person.id))
    const onTechnicians = { ...initialTechnicianMapSelection(), technicianIds: onlyBare }
    expect(markerPeople(onTechnicians, people, tickets).map((person) => person.id)).toEqual(['c'])
    const onTickets = switchTechnicianMapMode(onTechnicians, 'tickets')
    expect(markerPeople(onTickets, people, tickets).map((person) => person.id).sort()).toEqual(['a', 'b'])
    expect(markerPeople(onTickets, people, tickets).some((person) => person.id === 'd')).toBe(false)
  })

  it('выбор всех и снятие действуют на полный список', () => {
    expect(selectAllIds()).toBe('all')
    expect(clearIds()).toEqual([])
    expect(selectionCountLabel(clearIds(), ['a', 'b'])).toBe('0')
  })
})
