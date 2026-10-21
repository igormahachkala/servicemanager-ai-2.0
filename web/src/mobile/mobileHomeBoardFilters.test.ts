import { describe, expect, it } from 'vitest'
import {
  isActiveMobileMyTicket,
  ticketsForMobileMyPage,
} from './mobileHomeBoardFilters'
import { buildMobileHomeVisibleTickets, groupTicketsByLocation } from './mobileHomeListUtils'
import { PUSH_ENABLE_PREFS, enablePushNotifications } from './mobilePushActivation'
import type { TicketCard } from '../lib/api'

function ticket(id: string, status: TicketCard['status'], assignedTechnicianId: string | null, createdByUserId = 'creator') {
  return {
    id,
    status,
    assignedTechnicianId,
    assignedTechnician: assignedTechnicianId ? { id: assignedTechnicianId, email: `${assignedTechnicianId}@test.local` } : null,
    createdByUserId,
  }
}

function homeTicket(id: string, status: TicketCard['status'], locationId = 'loc-a'): TicketCard {
  return {
    ...ticket(id, status, status === 'NEW' ? null : 'me'),
    ticketNumber: Number(id.replace(/\D/g, '')) || 1,
    title: `Ticket ${id}`,
    description: `Description ${id}`,
    createdAt: '2026-08-18T12:00:00.000Z',
    priority: 'NORMAL',
    urgency: 'NORMAL',
    slaBreached: false,
    category: { id: 'cat-other', name: 'Другое' },
    location: {
      id: locationId,
      name: locationId === 'loc-a' ? 'Фудзияма ИП Шиц' : 'ИП Ермаков',
      city: 'Ижевск',
      address: locationId === 'loc-a' ? 'Пушкина, 1' : 'Ленина, 2',
    },
  } as TicketCard
}

function visibleHomeTickets(cards: TicketCard[], tab: 'all' | 'done') {
  return buildMobileHomeVisibleTickets({
    cards,
    tab,
    meId: 'me',
    meRole: 'TECHNICIAN',
    chips: new Set(),
    searchQuery: '',
    atRiskThresholdMinutes: 60,
    nowMs: Date.parse('2026-08-19T00:00:00.000Z'),
  })
}

function activeMine(tickets: ReturnType<typeof ticket>[], role: 'TECHNICIAN' | 'MASTER' = 'TECHNICIAN') {
  return ticketsForMobileMyPage(tickets as TicketCard[], 'active', 'me', role)
    .filter(isActiveMobileMyTicket)
    .map((row) => row.id)
}

function makeSub(id = 'sub') {
  return { endpoint: `https://push.example/${id}` }
}

async function runEnable(overrides: Partial<Parameters<typeof enablePushNotifications>[0]['deps']> = {}) {
  const calls: Array<[string, string?, boolean?]> = []
  const deps = {
    requestPermission: async () => 'granted' as const,
    registerServiceWorker: async () => ({ scope: '/' }) as ServiceWorkerRegistration,
    getExistingSubscription: async () => null,
    subscribeToPush: async () => makeSub('new') as unknown as PushSubscription,
    serializeSubscription: (sub: PushSubscription) => ({
      endpoint: (sub as unknown as { endpoint: string }).endpoint,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }),
    saveSubscription: async (payload: { endpoint: string; platform: string }) => {
      calls.push(['save', payload.endpoint, payload.platform === 'android'])
    },
    updatePreferences: async (patch: { chat?: boolean; news?: boolean }) => {
      calls.push(['prefs', String(patch.chat), patch.news])
      return { ...PUSH_ENABLE_PREFS, ...patch }
    },
    refreshCanonicalState: async () => {
      calls.push(['refresh'])
    },
    ...overrides,
  }
  const result = await enablePushNotifications({
    vapidPublicKey: 'vapid-key',
    platform: 'android',
    deps,
    timeoutMs: 200,
  })
  return { result, calls }
}

describe('mobile home filters and push', () => {
  it('lists active mine tickets for a technician', () => {
    const tickets = [
      ticket('new-assigned', 'NEW', 'me'),
      ticket('assigned', 'ASSIGNED', 'me'),
      ticket('in-progress', 'IN_PROGRESS', 'me'),
      ticket('awaiting', 'AWAITING_ACCEPTANCE', 'me'),
      ticket('done', 'DONE', 'me'),
      ticket('canceled', 'CANCELED', 'me'),
      ticket('other-tech', 'ASSIGNED', 'other'),
    ]
    expect(activeMine(tickets)).toEqual(['new-assigned', 'assigned', 'in-progress', 'awaiting'])
  })

  it('includes tickets a master created', () => {
    const tickets = [
      ticket('master-assigned', 'ASSIGNED', 'me', 'someone-else'),
      ticket('master-created', 'NEW', 'other', 'me'),
      ticket('master-other', 'IN_PROGRESS', 'other', 'someone-else'),
    ]
    expect(activeMine(tickets, 'MASTER')).toEqual(['master-assigned', 'master-created'])
  })

  it('hides another technician assignment from mine', () => {
    const tickets = [ticket('mine', 'ASSIGNED', 'me'), ticket('another-technician', 'ASSIGNED', 'other')]
    expect(activeMine(tickets)).toEqual(['mine'])
  })

  it('treats awaiting as active and done/canceled as not', () => {
    expect(isActiveMobileMyTicket(ticket('done', 'DONE', 'me') as TicketCard)).toBe(false)
    expect(isActiveMobileMyTicket(ticket('canceled', 'CANCELED', 'me') as TicketCard)).toBe(false)
    expect(isActiveMobileMyTicket(ticket('awaiting', 'AWAITING_ACCEPTANCE', 'me') as TicketCard)).toBe(true)
  })

  it('groups completed tickets by location', () => {
    const completed = [
      homeTicket('done-1', 'DONE', 'loc-a'),
      homeTicket('done-2', 'DONE', 'loc-a'),
      homeTicket('done-3', 'DONE', 'loc-b'),
    ]
    const visible = visibleHomeTickets(completed, 'done')
    expect(visible.map((row) => row.id).sort()).toEqual(['done-1', 'done-2', 'done-3'])
    const groups = groupTicketsByLocation(visible, { renderMode: 'done' })
    expect(groups).toHaveLength(2)
    expect(groups.reduce((sum, group) => sum + group.doneTickets, 0)).toBe(3)
    expect(groups.reduce((sum, group) => sum + group.tickets.length, 0)).toBe(3)
  })

  it('does not render done tickets on the all tab', () => {
    const mixed = [homeTicket('new-1', 'NEW', 'loc-a'), homeTicket('done-1', 'DONE', 'loc-a')]
    const visible = visibleHomeTickets(mixed, 'all')
    const groups = groupTicketsByLocation(visible)
    expect(groups.flatMap((group) => group.tickets).map((row) => row.id)).toEqual(['new-1'])
  })

  it('keeps done tickets in the done render mode', () => {
    const visible = visibleHomeTickets([homeTicket('done-1', 'DONE', 'loc-a')], 'done')
    const groups = groupTicketsByLocation(visible, { renderMode: 'done' })
    expect(visible).toHaveLength(1)
    expect(groups.flatMap((group) => group.tickets)).toHaveLength(1)
  })

  it('saves a new push subscription then prefs then refresh', async () => {
    const { result, calls } = await runEnable()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.subscribed).toBe(true)
    expect(calls.map((call) => call[0])).toEqual(['save', 'prefs', 'refresh'])
  })

  it('reuses an existing subscription', async () => {
    const existing = makeSub('existing')
    const { result, calls } = await runEnable({
      getExistingSubscription: async () => existing as unknown as PushSubscription,
      subscribeToPush: async () => {
        throw new Error('must reuse existing subscription')
      },
    })
    expect(result.ok).toBe(true)
    expect(calls[0]?.[1]).toBe(existing.endpoint)
  })

  it('returns backend_error when save fails after subscribe', async () => {
    const { result, calls } = await runEnable({
      saveSubscription: async () => {
        throw new Error('backend down')
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('backend_error')
      expect(result.subscribed).toBe(true)
    }
    expect(calls).toEqual([])
  })

  it('returns permission_denied without subscribing', async () => {
    const { result } = await runEnable({
      requestPermission: async () => 'denied',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('permission_denied')
      expect(result.subscribed).toBe(false)
    }
  })
})
