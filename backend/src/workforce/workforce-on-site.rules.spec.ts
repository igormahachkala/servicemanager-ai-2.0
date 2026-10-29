import {
  displayedFacts,
  formatDistanceMeters,
  formatProviderClock,
  lineNotes,
  ON_SITE_OUTCOMES,
  outcomeLabel,
  resolveOutcome,
  silenceNote,
  arrivalTicketHref,
} from './workforce-on-site.rules'

const AT = new Date('2026-10-27T07:12:00.000Z')

describe('on-site labels and displayed times', () => {
  it('formats meters below 1000 and kilometers with a comma from 1000', () => {
    expect(formatDistanceMeters(100)).toBe('100 м')
    expect(formatDistanceMeters(999)).toBe('999 м')
    expect(formatDistanceMeters(1000)).toBe('1,0 км')
    expect(formatDistanceMeters(2400)).toBe('2,4 км')
  })

  it('uses the provider timezone and falls back to UTC', () => {
    expect(formatProviderClock(AT, null)).toBe('07:12')
    expect(formatProviderClock(AT, '')).toBe('07:12')
    expect(formatProviderClock(AT, 'Not/AZone')).toBe('07:12')
    expect(formatProviderClock(AT, 'Asia/Krasnoyarsk')).toBe('14:12')
    expect(
      outcomeLabel({
        outcome: 'arrived',
        arrivedAt: AT,
        departedAt: null,
        distanceMeters: null,
        lastGeoAt: AT,
        now: AT,
        timezone: 'Asia/Krasnoyarsk',
      }),
    ).toBe('Прибыл в 14:12')
    expect(
      outcomeLabel({
        outcome: 'departed',
        arrivedAt: AT,
        departedAt: new Date('2026-10-27T08:40:00.000Z'),
        distanceMeters: null,
        lastGeoAt: AT,
        now: AT,
        timezone: 'Asia/Krasnoyarsk',
      }),
    ).toBe('Убыл в 15:40')
  })

  it('keeps the five outcomes in the plan order and does not collapse them', () => {
    expect(ON_SITE_OUTCOMES).toEqual(['no_coordinates', 'not_arrived', 'no_fresh', 'arrived', 'departed'])
    expect(resolveOutcome({ hasLocationCoordinates: false, arrivedAt: AT, departedAt: null, fresh: true })).toBe(
      'no_coordinates',
    )
    expect(resolveOutcome({ hasLocationCoordinates: true, arrivedAt: null, departedAt: null, fresh: true })).toBe(
      'not_arrived',
    )
    expect(resolveOutcome({ hasLocationCoordinates: true, arrivedAt: null, departedAt: null, fresh: false })).toBe(
      'no_fresh',
    )
    expect(resolveOutcome({ hasLocationCoordinates: true, arrivedAt: AT, departedAt: null, fresh: false })).toBe(
      'arrived',
    )
    expect(
      resolveOutcome({
        hasLocationCoordinates: true,
        arrivedAt: AT,
        departedAt: new Date('2026-10-27T08:40:00.000Z'),
        fresh: false,
      }),
    ).toBe('departed')
  })

  it('writes the not-arrived line with distance and age', () => {
    const lastGeoAt = new Date('2026-10-27T07:08:00.000Z')
    const now = new Date('2026-10-27T07:12:00.000Z')
    expect(
      outcomeLabel({
        outcome: 'not_arrived',
        arrivedAt: null,
        departedAt: null,
        distanceMeters: 2400,
        lastGeoAt,
        now,
        timezone: 'UTC',
      }),
    ).toBe('Не прибыл, 2,4 км, точка 4 мин назад')
  })

  it('adds silence and a closed shift without replacing the fact', () => {
    const lastGeoAt = new Date('2026-10-27T11:20:00.000Z')
    expect(silenceNote(lastGeoAt, 'UTC')).toBe(
      'Нет свежих данных с 11:20. Приложение не открыто или телефон в спящем режиме.',
    )
    expect(
      lineNotes({
        outcome: 'arrived',
        fresh: false,
        shiftOpen: false,
        lastGeoAt,
        timezone: 'UTC',
      }),
    ).toEqual([
      'Нет свежих данных с 11:20. Приложение не открыто или телефон в спящем режиме.',
      'Смена закрыта. Наблюдение не ведётся.',
    ])
  })

  it('shows the newer correction, drops an empty fact, and returns to automatic times after a later automaton event', () => {
    const automaticArrived = new Date('2026-10-27T07:01:00.000Z')
    const correctedDeparted = new Date('2026-10-27T08:30:00.000Z')
    const correction = {
      createdAt: new Date('2026-10-27T08:00:00.000Z'),
      correctedArrivedAt: null,
      correctedDepartedAt: correctedDeparted,
    }
    expect(
      displayedFacts({
        arrivedAt: automaticArrived,
        departedAt: null,
        lastAutoEventAt: new Date('2026-10-27T07:02:00.000Z'),
        correction,
      }),
    ).toEqual({ arrivedAt: null, departedAt: correctedDeparted })

    expect(
      displayedFacts({
        arrivedAt: automaticArrived,
        departedAt: new Date('2026-10-27T09:10:00.000Z'),
        lastAutoEventAt: new Date('2026-10-27T09:11:00.000Z'),
        correction,
      }),
    ).toEqual({
      arrivedAt: automaticArrived,
      departedAt: new Date('2026-10-27T09:10:00.000Z'),
    })
  })

  it('builds the ticket link with the client company id', () => {
    expect(arrivalTicketHref('ticket-1', 'client-9')).toBe('/tickets/ticket-1?linkedClientCompanyId=client-9')
  })
})
