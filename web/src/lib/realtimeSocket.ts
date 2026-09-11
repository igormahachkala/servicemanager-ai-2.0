export type RealtimeScope = {
  linkedClientCompanyId?: string
  companyId?: string
}

export type RealtimeMessage = Record<string, unknown> & { type?: string }

type RealtimeListener = (message: RealtimeMessage) => void
type RealtimeDiagnostic = (state: string, details?: Record<string, number | string>) => void

type RealtimeSocketOptions = {
  createSocket?: (url: string) => WebSocket
  random?: () => number
  setTimeout?: typeof window.setTimeout
  clearTimeout?: typeof window.clearTimeout
  setInterval?: typeof window.setInterval
  clearInterval?: typeof window.clearInterval
  isOnline?: () => boolean
  addWindowListener?: typeof window.addEventListener
  removeWindowListener?: typeof window.removeEventListener
  diagnostic?: RealtimeDiagnostic
}

const AUTH_CHANGED_EVENT = 'sma:auth-token-changed'
const TOKEN_STORAGE_KEY = 'sm_token'
const MAX_RECONNECT_DELAY_MS = 30_000
const HEARTBEAT_INTERVAL_MS = 25_000
const PONG_TIMEOUT_MS = 10_000
const STABLE_CONNECTION_MS = 10_000
const IDLE_DISCONNECT_GRACE_MS = 250
const MAX_SEEN_MESSAGES = 500

export function reconnectDelayMs(attempt: number, random = Math.random) {
  const exponential = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** Math.max(0, attempt))
  return Math.min(MAX_RECONNECT_DELAY_MS, exponential + Math.floor(random() * 500))
}

export class RealtimeSocketManager {
  private readonly createSocket: (url: string) => WebSocket
  private readonly random: () => number
  private readonly setTimeoutFn: typeof window.setTimeout
  private readonly clearTimeoutFn: typeof window.clearTimeout
  private readonly setIntervalFn: typeof window.setInterval
  private readonly clearIntervalFn: typeof window.clearInterval
  private readonly isOnline: () => boolean
  private readonly addWindowListener?: typeof window.addEventListener
  private readonly removeWindowListener?: typeof window.removeEventListener
  private readonly diagnostic?: RealtimeDiagnostic

  private listeners = new Set<RealtimeListener>()
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private pongTimer: number | null = null
  private stableTimer: number | null = null
  private idleDisconnectTimer: number | null = null
  private url = ''
  private token = ''
  private scope: RealtimeScope = {}
  private reconnectAttempt = 0
  private authRejected = false
  private windowListenersAttached = false
  private seenMessageKeys = new Set<string>()

  constructor(options: RealtimeSocketOptions = {}) {
    this.createSocket = options.createSocket || ((url) => new WebSocket(url))
    this.random = options.random || Math.random
    this.setTimeoutFn = options.setTimeout || window.setTimeout.bind(window)
    this.clearTimeoutFn = options.clearTimeout || window.clearTimeout.bind(window)
    this.setIntervalFn = options.setInterval || window.setInterval.bind(window)
    this.clearIntervalFn = options.clearInterval || window.clearInterval.bind(window)
    this.isOnline = options.isOnline || (() => navigator.onLine)
    this.addWindowListener = options.addWindowListener || window.addEventListener.bind(window)
    this.removeWindowListener = options.removeWindowListener || window.removeEventListener.bind(window)
    this.diagnostic = options.diagnostic
  }

  configure(config: { url: string; token: string; scope?: RealtimeScope }) {
    const nextScope = config.scope || {}
    const urlChanged = this.url !== config.url
    const tokenChanged = this.token !== config.token
    const scopeChanged =
      this.scope.companyId !== nextScope.companyId ||
      this.scope.linkedClientCompanyId !== nextScope.linkedClientCompanyId

    this.url = config.url
    this.scope = nextScope

    if (tokenChanged) {
      this.token = config.token
      this.authRejected = false
      this.reconnectAttempt = 0
      this.stopConnection()
    }

    if (urlChanged) this.stopConnection()

    if (scopeChanged && this.socket?.readyState === 1) {
      this.sendSubscriptions()
    }

    this.ensureConnection()
  }

  subscribe(listener: RealtimeListener) {
    this.clearIdleDisconnectTimer()
    this.listeners.add(listener)
    this.attachWindowListeners()
    this.ensureConnection()

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size > 0) return
      this.detachWindowListeners()
      this.idleDisconnectTimer = this.setTimeoutFn(() => {
        this.idleDisconnectTimer = null
        if (this.listeners.size > 0) return
        this.stopConnection()
        this.reconnectAttempt = 0
        this.authRejected = false
      }, IDLE_DISCONNECT_GRACE_MS)
    }
  }

  private ensureConnection() {
    if (this.listeners.size === 0 || !this.url || !this.token || this.authRejected || !this.isOnline()) return
    if (this.socket || this.reconnectTimer !== null) return
    this.connect()
  }

  private connect() {
    if (this.listeners.size === 0 || !this.token || this.authRejected || !this.isOnline()) return

    this.diagnostic?.('connecting', { attempt: this.reconnectAttempt + 1 })
    let socket: WebSocket
    try {
      socket = this.createSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) return
      this.send({ type: 'auth', token: this.token })
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      let message: RealtimeMessage
      try {
        message = JSON.parse(String(event.data)) as RealtimeMessage
      } catch {
        return
      }

      if (message.type === 'pong') {
        this.clearPongTimer()
        return
      }

      if (message.type === 'AUTH_INVALID' || message.type === 'AUTH_REQUIRED') {
        this.authRejected = true
        this.clearReconnectTimer()
        this.diagnostic?.('auth rejected')
        socket.close(1000, 'Authentication rejected')
        return
      }

      if (message.type === 'session.ready') {
        this.diagnostic?.('connected')
        this.startHeartbeat()
        this.sendSubscriptions()
        this.startStableConnectionTimer()
        return
      }

      if (this.isDuplicateMessage(message)) return
      for (const listener of this.listeners) listener(message)
    }

    socket.onclose = (event) => {
      if (this.socket !== socket) return
      this.socket = null
      this.clearConnectionTimers()
      if (event.code === 1008) this.authRejected = true
      this.diagnostic?.(this.authRejected ? 'auth rejected' : 'disconnected', { code: event.code })
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      // onclose owns reconnect scheduling so one failure creates one timer.
    }
  }

  private sendSubscriptions() {
    this.send({ type: 'subscribe', subscriptionId: 'board', scope: 'board', params: this.scope })
    this.send({ type: 'subscribe', subscriptionId: 'notifications', scope: 'notifications' })
  }

  private send(message: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== 1) return
    try {
      this.socket.send(JSON.stringify(message))
    } catch {
      this.socket.close()
    }
  }

  private scheduleReconnect(delayOverride?: number) {
    if (
      this.reconnectTimer !== null ||
      this.listeners.size === 0 ||
      !this.token ||
      this.authRejected ||
      !this.isOnline()
    ) return

    const delay = delayOverride ?? reconnectDelayMs(this.reconnectAttempt, this.random)
    this.reconnectAttempt += 1
    this.diagnostic?.('retry scheduled', { attempt: this.reconnectAttempt, delayMs: delay })
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null
      this.ensureConnection()
    }, delay)
  }

  private startStableConnectionTimer() {
    if (this.stableTimer !== null) this.clearTimeoutFn(this.stableTimer)
    this.stableTimer = this.setTimeoutFn(() => {
      this.stableTimer = null
      this.reconnectAttempt = 0
    }, STABLE_CONNECTION_MS)
  }

  private startHeartbeat() {
    this.clearHeartbeat()
    this.heartbeatTimer = this.setIntervalFn(() => {
      this.send({ type: 'ping' })
      this.clearPongTimer()
      this.pongTimer = this.setTimeoutFn(() => {
        this.pongTimer = null
        this.socket?.close()
      }, PONG_TIMEOUT_MS)
    }, HEARTBEAT_INTERVAL_MS)
  }

  private clearPongTimer() {
    if (this.pongTimer === null) return
    this.clearTimeoutFn(this.pongTimer)
    this.pongTimer = null
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer !== null) {
      this.clearIntervalFn(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.clearPongTimer()
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) return
    this.clearTimeoutFn(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private clearIdleDisconnectTimer() {
    if (this.idleDisconnectTimer === null) return
    this.clearTimeoutFn(this.idleDisconnectTimer)
    this.idleDisconnectTimer = null
  }

  private clearConnectionTimers() {
    this.clearHeartbeat()
    if (this.stableTimer !== null) {
      this.clearTimeoutFn(this.stableTimer)
      this.stableTimer = null
    }
  }

  private isDuplicateMessage(message: RealtimeMessage) {
    const id =
      typeof message.eventId === 'string'
        ? message.eventId
        : typeof message.notificationId === 'string'
          ? message.notificationId
          : ''
    if (!id || !message.type) return false
    const key = `${message.type}:${id}`
    if (this.seenMessageKeys.has(key)) return true
    this.seenMessageKeys.add(key)
    if (this.seenMessageKeys.size > MAX_SEEN_MESSAGES) {
      this.seenMessageKeys.delete(this.seenMessageKeys.values().next().value as string)
    }
    return false
  }

  private stopConnection() {
    this.clearReconnectTimer()
    this.clearConnectionTimers()
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onclose = null
    socket.onmessage = null
    socket.onopen = null
    socket.onerror = null
    try {
      socket.close(1000, 'Client session changed')
    } catch {
      // The browser may already have disposed the transport.
    }
  }

  private handleOnline = () => this.ensureConnection()
  private handleOffline = () => this.stopConnection()

  private handleStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_STORAGE_KEY) this.updateToken(event.newValue || '')
  }

  private handleAuthChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ token?: unknown }>).detail
    const token = typeof detail?.token === 'string' ? detail.token : ''
    this.updateToken(token)
  }

  private updateToken(token: string) {
    if (this.token === token) return
    this.token = token
    this.authRejected = false
    this.reconnectAttempt = 0
    this.clearIdleDisconnectTimer()
    this.stopConnection()
    this.ensureConnection()
  }

  private attachWindowListeners() {
    if (this.windowListenersAttached || !this.addWindowListener) return
    this.addWindowListener('online', this.handleOnline)
    this.addWindowListener('offline', this.handleOffline)
    this.addWindowListener('storage', this.handleStorage)
    this.addWindowListener(AUTH_CHANGED_EVENT, this.handleAuthChanged)
    this.windowListenersAttached = true
  }

  private detachWindowListeners() {
    if (!this.windowListenersAttached || !this.removeWindowListener) return
    this.removeWindowListener('online', this.handleOnline)
    this.removeWindowListener('offline', this.handleOffline)
    this.removeWindowListener('storage', this.handleStorage)
    this.removeWindowListener(AUTH_CHANGED_EVENT, this.handleAuthChanged)
    this.windowListenersAttached = false
  }
}

let sharedManager: RealtimeSocketManager | null = null

function getSharedManager() {
  if (!sharedManager) {
    sharedManager = new RealtimeSocketManager({
      diagnostic: import.meta.env.DEV
        ? (state, details) => console.debug('[realtime]', state, details || {})
        : undefined,
    })
  }
  return sharedManager
}

export function configureRealtimeSocket(config: { url: string; token: string; scope?: RealtimeScope }) {
  getSharedManager().configure(config)
}

export function subscribeRealtimeSocket(listener: RealtimeListener) {
  return getSharedManager().subscribe(listener)
}

export function notifyRealtimeAuthChanged(token: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { token } }))
}
