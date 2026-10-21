import { describe, expect, it } from 'vitest'
import { fieldChangeLines } from './ticketChat'

describe('ticket chat planned due history', () => {
  it('renders planned due changes with a Russian label and empty value text', () => {
    expect(
      fieldChangeLines({
        plannedDueAt: {
          from: null,
          to: '2030-01-02T10:30:00.000Z',
        },
      }),
    ).toEqual(['Срок выполнения:', expect.stringMatching(/^не задан → \d{2}\.\d{2}\.\d{4}/)])
  })
})
