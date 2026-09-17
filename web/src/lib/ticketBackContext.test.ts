import { describe, expect, it } from 'vitest'

import { buildTicketBackLabel } from './ticketBackContext'

const ticket = {
  location: { id: 'loc-ufa-5', name: 'Уфа 5' },
  equipment: { id: 'eq-fridge', name: 'Холодильник' },
  pointName: 'Уфа 5',
}

describe('ticket back context label', () => {
  it('falls back to tickets when no list context is available', () => {
    expect(buildTicketBackLabel()).toBe('← Назад к заявкам')
  })

  it('uses a human scope label without exposing raw ids', () => {
    expect(
      buildTicketBackLabel({
        context: { scopeLabel: 'Просроченные', sourcePath: '/tickets' },
        ticket,
      }),
    ).toBe('← Назад к просроченным')
  })

  it('combines overdue source and location name', () => {
    expect(
      buildTicketBackLabel({
        context: {
          selectedLocationId: 'loc-ufa-5',
          scopeLabel: 'Просроченные',
        },
        ticket,
      }),
    ).toBe('← Назад к просроченным · Уфа 5')
  })

  it('parses legacy location arrow scope labels into target and detail', () => {
    expect(
      buildTicketBackLabel({
        context: { scopeLabel: 'Уфа 5 → Просроченные' },
        ticket,
      }),
    ).toBe('← Назад к просроченным · Уфа 5')
  })

  it('does not render UUID-like labels', () => {
    const label = buildTicketBackLabel({
      context: {
        selectedLocationId: '6d0640da-6470-4f4e-a052-34a5c9ab2cf6',
        selectedEquipmentId: '6d0640da-6470-4f4e-a052-34a5c9ab2cf7',
        scopeLabel: '6d0640da-6470-4f4e-a052-34a5c9ab2cf8',
      },
      ticket: {
        location: { id: '6d0640da-6470-4f4e-a052-34a5c9ab2cf6', name: '6d0640da-6470-4f4e-a052-34a5c9ab2cf8' },
        equipment: { id: '6d0640da-6470-4f4e-a052-34a5c9ab2cf7', name: '6d0640da-6470-4f4e-a052-34a5c9ab2cf9' },
        pointName: null,
      },
    })

    expect(label).toBe('← Назад к заявкам')
    expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })
})
