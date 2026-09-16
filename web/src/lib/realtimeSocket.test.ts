import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  REALTIME_SERVER_REJECT_NOTICE,
  RealtimeSocketManager,
  reconnectDelayMs,
} from './realtimeSocket'

class MockSocket {
  readyState = 0
  sent: string[] = []
  onopen: ((event: object) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: ((event: object) => void) | null = null

  open() {
    this.readyState = 1
    this.onopen?.({})
  }

  message(message: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  close(code = 1006) {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.({ code })
  }

  messages() {
    return this.sent.map((value) => JSON.parse(value) as Record<string, unknown>)
  }

  send(value: string) {
    this.sent.push(value)
  }
}

function createHarness() {
  vi.useFakeTimers()
  let online = true
  const sockets: MockSocket[] = []
  const windowListeners = new Map<string, Set<(event: { type: string; detail?: { token?: string } }) => void>>()
  const authRejectedEvents: object[] = []
  const serverNotices: { code: string; text: string }[] = []

  const addWindowListener = (type: string, listener: (event: { type: string; detail?: { token?: string } }) => void) => {
    const listeners = windowListeners.get(type) || new Set()
    listeners.add(listener)
    windowListeners.set(type, listeners)
  }
  const removeWindowListener = (type: string, listener: (event: { type: string; detail?: { token?: string } }) => void) => {
    windowListeners.get(type)?.delete(listener)
  }

  const manager = new RealtimeSocketManager({
    createSocket: () => {
      const socket = new MockSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    random: () => 0,
    setTimeout: ((callback: TimerHandler, delay?: number) => setTimeout(callback, delay)) as typeof window.setTimeout,
    clearTimeout: ((id: number) => clearTimeout(id)) as typeof window.clearTimeout,
    setInterval: ((callback: TimerHandler, delay?: number) => setInterval(callback, delay)) as typeof window.setInterval,
    clearInterval: ((id: number) => clearInterval(id)) as typeof window.clearInterval,
    isOnline: () => online,
    addWindowListener: addWindowListener as typeof window.addEventListener,
    removeWindowListener: removeWindowListener as typeof window.removeEventListener,
    onAuthRejected: () => authRejectedEvents.push({}),
    onServerNotice: (notice) => serverNotices.push(notice),
  })

  return {
    manager,
    sockets,
    windowListeners,
    authRejectedEvents,
    serverNotices,
    setOnline(value: boolean) {
      online = value
      for (const listener of windowListeners.get(value ? 'online' : 'offline') || []) {
        listener({ type: value ? 'online' : 'offline' })
      }
    },
    dispatch(type: string, event: { type: string; detail?: { token?: string } }) {
      for (const listener of windowListeners.get(type) || []) listener(event)
    },
  }
}

function openReadySocket(h: ReturnType<typeof createHarness>) {
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets.at(-1)?.open()
  h.sockets.at(-1)?.message({ type: 'session.ready' })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('RealtimeSocketManager', () => {
  it('bounds reconnect delay', () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(500)
    expect(reconnectDelayMs(1, () => 0)).toBe(1000)
    expect(reconnectDelayMs(20, () => 0.999)).toBe(30000)
  })

  it('shares one socket, dedupes events and closes after the last consumer', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token', scope: { companyId: 'company-a' } })
    const received: unknown[] = []
    const unsubscribeA = h.manager.subscribe((message) => received.push(message))
    const unsubscribeB = h.manager.subscribe(() => {})
    expect(h.sockets).toHaveLength(1)
    expect(h.windowListeners.get('online')?.size).toBe(1)
    expect(h.windowListeners.has('visibilitychange')).toBe(false)

    h.sockets[0].open()
    h.sockets[0].message({ type: 'session.ready' })
    h.sockets[0].message({ type: 'ticket.updated', ticketId: 'ticket-1' })
    h.sockets[0].message({ type: 'ticket.updated', eventId: 'event-1', ticketId: 'ticket-1' })
    h.sockets[0].message({ type: 'ticket.updated', eventId: 'event-1', ticketId: 'ticket-1' })
    expect(received).toHaveLength(2)

    h.manager.configure({ url: 'ws://example/ws', token: 'token', scope: { companyId: 'company-b' } })
    expect(h.sockets).toHaveLength(1)
    const boardSubscriptions = h.sockets[0].messages().filter((message) => message.subscriptionId === 'board')
    expect(boardSubscriptions).toHaveLength(2)
    expect((boardSubscriptions[1].params as { companyId: string }).companyId).toBe('company-b')

    unsubscribeA()
    unsubscribeB()
    vi.advanceTimersByTime(250)
    expect(h.sockets[0].readyState).toBe(3)
    expect(h.windowListeners.get('online')?.size).toBe(0)
  })

  it('keeps the socket when a new consumer arrives inside the idle grace', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    const unsubscribeDesktop = h.manager.subscribe(() => {})
    unsubscribeDesktop()
    const unsubscribeMobile = h.manager.subscribe(() => {})
    expect(h.sockets).toHaveLength(1)
    vi.advanceTimersByTime(249)
    expect(h.sockets[0].readyState).not.toBe(3)
    unsubscribeMobile()
    vi.advanceTimersByTime(250)
    expect(h.sockets[0].readyState).toBe(3)
  })

  it('retries once then grows backoff', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.sockets[0].close()
    h.sockets[0].onclose?.({ code: 1006 })
    vi.advanceTimersByTime(499)
    expect(h.sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(h.sockets).toHaveLength(2)
    h.sockets[1].close()
    vi.advanceTimersByTime(999)
    expect(h.sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(h.sockets).toHaveLength(3)
  })

  it('keeps growing backoff if the socket dies before the stable timer', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.sockets[0].close()
    vi.advanceTimersByTime(500)
    h.sockets[1].close()
    vi.advanceTimersByTime(1000)
    h.sockets[2].open()
    h.sockets[2].message({ type: 'session.ready' })
    h.sockets[2].close()
    vi.advanceTimersByTime(1999)
    expect(h.sockets).toHaveLength(3)
    vi.advanceTimersByTime(1)
    expect(h.sockets).toHaveLength(4)
  })

  it('resets backoff after the connection stays up for 60s', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.sockets[0].close()
    vi.advanceTimersByTime(500)
    h.sockets[1].close()
    vi.advanceTimersByTime(1000)
    h.sockets[2].open()
    h.sockets[2].message({ type: 'session.ready' })
    vi.advanceTimersByTime(25_000)
    h.sockets[2].message({ type: 'pong' })
    vi.advanceTimersByTime(25_000)
    h.sockets[2].message({ type: 'pong' })
    vi.advanceTimersByTime(10_000)
    h.sockets[2].close()
    vi.advanceTimersByTime(499)
    expect(h.sockets).toHaveLength(3)
    vi.advanceTimersByTime(1)
    expect(h.sockets).toHaveLength(4)
  })

  it('reconnects one-for-one on offline/online', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.setOnline(false)
    expect(h.sockets[0].readyState).toBe(3)
    h.setOnline(true)
    expect(h.sockets).toHaveLength(2)
    h.setOnline(true)
    expect(h.sockets).toHaveLength(2)
    h.setOnline(false)
    h.setOnline(true)
    expect(h.sockets).toHaveLength(3)
  })

  it('does not reconnect after AUTH_INVALID', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
    h.manager.subscribe(() => {})
    h.sockets[0].open()
    h.sockets[0].message({ type: 'AUTH_INVALID' })
    h.sockets[0].close(1008)
    vi.advanceTimersByTime(30_000)
    expect(h.sockets).toHaveLength(1)
  })

  it('closes on logout and opens once for a new token', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.dispatch('sma:auth-token-changed', { type: 'sma:auth-token-changed', detail: { token: '' } })
    expect(h.sockets[0].readyState).toBe(3)
    h.dispatch('sma:auth-token-changed', { type: 'sma:auth-token-changed', detail: { token: 'new-token' } })
    expect(h.sockets).toHaveLength(2)
  })

  it('sends ping after session.ready and waits for pong', () => {
    const h = createHarness()
    openReadySocket(h)
    vi.advanceTimersByTime(25_000)
    expect(h.sockets[0].messages().at(-1)).toEqual({ type: 'ping' })
    h.sockets[0].message({ type: 'pong' })
    vi.advanceTimersByTime(10_000)
    expect(h.sockets[0].readyState).toBe(1)
  })

  it('closes once when pong does not arrive', () => {
    const h = createHarness()
    openReadySocket(h)
    vi.advanceTimersByTime(25_000)
    vi.advanceTimersByTime(10_000)
    expect(h.sockets[0].readyState).toBe(3)
    vi.advanceTimersByTime(500)
    expect(h.sockets).toHaveLength(2)
  })

  it('clears heartbeat on close', () => {
    const h = createHarness()
    openReadySocket(h)
    const sentBefore = h.sockets[0].sent.length
    h.sockets[0].close()
    vi.advanceTimersByTime(25_000)
    expect(h.sockets[0].sent.length).toBe(sentBefore)
  })

  it('reconnects on AUTH_REQUIRED and does not treat it as auth reject', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.sockets[0].open()
    h.sockets[0].message({ type: 'AUTH_REQUIRED' })
    h.sockets[0].close()
    expect(h.authRejectedEvents).toHaveLength(0)
    vi.advanceTimersByTime(500)
    expect(h.sockets).toHaveLength(2)
    h.sockets[1].close()
    vi.advanceTimersByTime(1000)
    expect(h.sockets).toHaveLength(3)
  })

  it('emits auth rejected once on AUTH_INVALID without a server notice', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
    h.manager.subscribe(() => {})
    h.sockets[0].open()
    h.sockets[0].message({ type: 'AUTH_INVALID' })
    h.sockets[0].close(1008)
    expect(h.authRejectedEvents).toHaveLength(1)
    expect(h.serverNotices).toHaveLength(0)
  })

  it('treats close 1008 without a frame as auth reject', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe(() => {})
    h.sockets[0].open()
    h.sockets[0].close(1008)
    expect(h.authRejectedEvents).toHaveLength(1)
    vi.advanceTimersByTime(30_000)
    expect(h.sockets).toHaveLength(1)
  })

  it('does not open a socket on subscribe after auth rejection', () => {
    const h = createHarness()
    h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
    h.manager.subscribe(() => {})
    h.sockets[0].open()
    h.sockets[0].message({ type: 'AUTH_INVALID' })
    const socketsAfterReject = h.sockets.length
    h.manager.subscribe(() => {})
    expect(h.sockets).toHaveLength(socketsAfterReject)
  })

  it('shows a fixed notice for subscription rejects and keeps the socket', () => {
    const h = createHarness()
    openReadySocket(h)
    const planted = 'Observer company scope is not allowed for this user'
    h.sockets[0].message({ type: 'SUBSCRIPTION_INVALID', code: 'SUBSCRIPTION_INVALID', message: planted })
    expect(h.serverNotices).toHaveLength(1)
    expect(h.serverNotices[0].text).toBe(REALTIME_SERVER_REJECT_NOTICE)
    expect(h.serverNotices[0].text).not.toBe(planted)
    expect(h.authRejectedEvents).toHaveLength(0)
    expect(h.sockets[0].readyState).toBe(1)
    expect(h.sockets).toHaveLength(1)

    h.sockets[0].message({ type: 'BAD_MESSAGE', code: 'BAD_MESSAGE', message: 'Message must be JSON' })
    h.sockets[0].message({ type: 'CUSTOM_REJECT', code: 'UNKNOWN_CODE', message: 'planted-unknown' })
    expect(h.serverNotices).toHaveLength(3)
    expect(h.serverNotices.every((notice) => notice.text === REALTIME_SERVER_REJECT_NOTICE)).toBe(true)
    expect(h.sockets[0].readyState).toBe(1)
  })

  it('dedupes frames by notificationId', () => {
    const h = createHarness()
    const received: unknown[] = []
    h.manager.configure({ url: 'ws://example/ws', token: 'token' })
    h.manager.subscribe((message) => received.push(message))
    h.sockets[0].open()
    h.sockets[0].message({ type: 'session.ready' })
    h.sockets[0].message({ type: 'ticket.updated', notificationId: 'n-1', ticketId: 'ticket-1' })
    h.sockets[0].message({ type: 'ticket.updated', notificationId: 'n-1', ticketId: 'ticket-1' })
    expect(received).toHaveLength(1)

    h.sockets[0].message({
      type: 'SUBSCRIPTION_INVALID',
      code: 'SUBSCRIPTION_INVALID',
      notificationId: 'n-2',
      message: 'Observer company scope does not exist',
    })
    h.sockets[0].message({
      type: 'SUBSCRIPTION_INVALID',
      code: 'SUBSCRIPTION_INVALID',
      notificationId: 'n-2',
      message: 'Observer company scope does not exist',
    })
    expect(h.serverNotices).toHaveLength(1)
  })
})
