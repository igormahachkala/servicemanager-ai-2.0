import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function loadTypeScript() {
  for (const candidate of ['typescript', '/Users/igor/projects/sma-service/web/node_modules/typescript']) {
    try {
      return require(candidate)
    } catch {}
  }
  throw new Error('Cannot load TypeScript. Run npm install in web/ before this focused check.')
}

const ts = loadTypeScript()
const filename = resolve(root, 'src/lib/realtimeSocket.ts')
const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env.DEV', 'false')
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: filename,
}).outputText
const module = { exports: {} }
const context = vm.createContext({ module, exports: module.exports, console })
vm.runInContext(output, context, { filename })
const { RealtimeSocketManager, reconnectDelayMs, REALTIME_SERVER_REJECT_NOTICE } = module.exports

class MockSocket {
  readyState = 0
  sent = []
  onopen = null
  onmessage = null
  onclose = null
  onerror = null

  open() {
    this.readyState = 1
    this.onopen?.({})
  }

  message(message) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  close(code = 1006) {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.({ code })
  }

  messages() {
    return this.sent.map((value) => JSON.parse(value))
  }

  send(value) {
    this.sent.push(value)
  }
}

function createHarness() {
  let nextTimerId = 1
  let online = true
  const sockets = []
  const timeouts = new Map()
  const intervals = new Map()
  const windowListeners = new Map()
  const authRejectedEvents = []
  const serverNotices = []

  const addWindowListener = (type, listener) => {
    const listeners = windowListeners.get(type) || new Set()
    listeners.add(listener)
    windowListeners.set(type, listeners)
  }
  const removeWindowListener = (type, listener) => windowListeners.get(type)?.delete(listener)

  const manager = new RealtimeSocketManager({
    createSocket: () => {
      const socket = new MockSocket()
      sockets.push(socket)
      return socket
    },
    random: () => 0,
    setTimeout: (callback, delay) => {
      const id = nextTimerId++
      timeouts.set(id, { callback, delay })
      return id
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (callback, delay) => {
      const id = nextTimerId++
      intervals.set(id, { callback, delay })
      return id
    },
    clearInterval: (id) => intervals.delete(id),
    isOnline: () => online,
    addWindowListener,
    removeWindowListener,
    onAuthRejected: () => authRejectedEvents.push({}),
    onServerNotice: (notice) => serverNotices.push(notice),
  })

  return {
    manager,
    sockets,
    timeouts,
    intervals,
    windowListeners,
    authRejectedEvents,
    serverNotices,
    setOnline(value) {
      online = value
      for (const listener of windowListeners.get(value ? 'online' : 'offline') || []) listener({ type: value ? 'online' : 'offline' })
    },
    dispatch(type, event = { type }) {
      for (const listener of windowListeners.get(type) || []) listener(event)
    },
    runTimeout(delay) {
      const entry = [...timeouts.entries()].find(([, timer]) => timer.delay === delay)
      assert.ok(entry, `Expected timeout with delay ${delay}; got ${[...timeouts.values()].map((timer) => timer.delay).join(', ')}`)
      const [id, timer] = entry
      timeouts.delete(id)
      timer.callback()
    },
    runInterval(delay) {
      const entry = [...intervals.entries()].find(([, timer]) => timer.delay === delay)
      assert.ok(entry, `Expected interval with delay ${delay}; got ${[...intervals.values()].map((timer) => timer.delay).join(', ')}`)
      entry[1].callback()
    },
  }
}

function openReadySocket(h) {
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets.at(-1).open()
  h.sockets.at(-1).message({ type: 'session.ready' })
}

assert.equal(reconnectDelayMs(0, () => 0), 500)
assert.equal(reconnectDelayMs(1, () => 0), 1000)
assert.equal(reconnectDelayMs(20, () => 0.999), 30000)

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token', scope: { companyId: 'company-a' } })
  const received = []
  const unsubscribeA = h.manager.subscribe((message) => received.push(message))
  const unsubscribeB = h.manager.subscribe(() => {})
  assert.equal(h.sockets.length, 1, 'multiple consumers must share one socket')
  assert.equal(h.windowListeners.get('online')?.size, 1, 'window lifecycle listener must be singleton')
  assert.equal(h.windowListeners.has('visibilitychange'), false, 'visibility changes must not create reconnects')

  h.sockets[0].open()
  h.sockets[0].message({ type: 'session.ready' })
  h.sockets[0].message({ type: 'ticket.updated', ticketId: 'ticket-1' })
  h.sockets[0].message({ type: 'ticket.updated', eventId: 'event-1', ticketId: 'ticket-1' })
  h.sockets[0].message({ type: 'ticket.updated', eventId: 'event-1', ticketId: 'ticket-1' })
  assert.equal(received.length, 2, 'replayed event IDs must be delivered only once')

  h.manager.configure({ url: 'ws://example/ws', token: 'token', scope: { companyId: 'company-b' } })
  assert.equal(h.sockets.length, 1, 'scope updates must not reconnect')
  const boardSubscriptions = h.sockets[0].messages().filter((message) => message.subscriptionId === 'board')
  assert.equal(boardSubscriptions.length, 2)
  assert.equal(boardSubscriptions[1].params.companyId, 'company-b')

  unsubscribeA()
  unsubscribeB()
  h.runTimeout(250)
  assert.equal(h.sockets[0].readyState, 3, 'last consumer cleanup must close the socket')
  assert.equal(h.windowListeners.get('online')?.size, 0, 'last consumer cleanup must remove window listeners')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  const unsubscribeDesktop = h.manager.subscribe(() => {})
  unsubscribeDesktop()
  const unsubscribeMobile = h.manager.subscribe(() => {})
  assert.equal(h.sockets.length, 1, 'shell transitions inside the grace period must preserve the connection')
  assert.equal(h.timeouts.size, 0, 'a replacement shell must cancel deferred teardown')
  unsubscribeMobile()
  h.runTimeout(250)
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets[0].close()
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [500], 'first failure must schedule one bounded retry')
  h.sockets[0].onclose?.({ code: 1006 })
  assert.equal(h.timeouts.size, 1, 'duplicate close signals must not duplicate retry timers')
  h.runTimeout(500)
  assert.equal(h.sockets.length, 2)
  h.sockets[1].close()
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [1000], 'backoff must increase after consecutive failures')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets[0].close()
  h.runTimeout(500)
  h.sockets[1].close()
  h.runTimeout(1000)
  h.sockets[2].open()
  h.sockets[2].message({ type: 'session.ready' })
  assert.ok([...h.timeouts.values()].some((timer) => timer.delay === 60_000), 'stable timer must wait at least 60s')
  assert.equal([...h.timeouts.values()].some((timer) => timer.delay === 10_000), false, '10s stable timer must not be scheduled')
  h.sockets[2].close()
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [2000], 'close before stable timer must keep growing backoff')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets[0].close()
  h.runTimeout(500)
  h.sockets[1].close()
  h.runTimeout(1000)
  h.sockets[2].open()
  h.sockets[2].message({ type: 'session.ready' })
  h.runTimeout(60_000)
  h.sockets[2].close()
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [500], 'stable connection must reset backoff after 60s')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.setOnline(false)
  assert.equal(h.sockets[0].readyState, 3)
  assert.equal(h.timeouts.size, 0, 'offline state must suppress retries')
  h.setOnline(true)
  assert.equal(h.sockets.length, 2, 'online event must create exactly one fresh connection')
  h.setOnline(true)
  assert.equal(h.sockets.length, 2, 'repeated online events must not duplicate the active connection')
  h.setOnline(false)
  h.setOnline(true)
  assert.equal(h.sockets.length, 3, 'repeated offline/online cycles must remain one-for-one')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
  h.manager.subscribe(() => {})
  h.sockets[0].open()
  h.sockets[0].message({ type: 'AUTH_INVALID' })
  h.sockets[0].close(1008)
  assert.equal(h.timeouts.size, 0, 'auth rejection must not enter a reconnect loop')
  assert.equal(h.sockets.length, 1)
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.dispatch('sma:auth-token-changed', { type: 'sma:auth-token-changed', detail: { token: '' } })
  assert.equal(h.sockets[0].readyState, 3, 'logout must close the active socket')
  assert.equal(h.timeouts.size, 0, 'logout must cancel reconnect work')
  h.dispatch('sma:auth-token-changed', { type: 'sma:auth-token-changed', detail: { token: 'new-token' } })
  assert.equal(h.sockets.length, 2, 'a new authenticated session may reconnect once')
}

{
  const h = createHarness()
  openReadySocket(h)
  assert.ok([...h.intervals.values()].some((timer) => timer.delay === 25_000), 'heartbeat interval must start after session.ready')
  h.runInterval(25_000)
  assert.deepEqual(h.sockets[0].messages().at(-1), { type: 'ping' })
  assert.ok([...h.timeouts.values()].some((timer) => timer.delay === 10_000), 'ping must arm the pong wait timer')
}

{
  const h = createHarness()
  openReadySocket(h)
  h.runInterval(25_000)
  h.sockets[0].message({ type: 'pong' })
  assert.equal([...h.timeouts.values()].some((timer) => timer.delay === 10_000), false, 'pong must clear the wait timer')
}

{
  const h = createHarness()
  openReadySocket(h)
  h.runInterval(25_000)
  h.runTimeout(10_000)
  assert.equal(h.sockets[0].readyState, 3, 'missing pong must close the socket once')
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [500], 'missing pong must schedule exactly one retry')
}

{
  const h = createHarness()
  openReadySocket(h)
  h.sockets[0].close()
  assert.equal([...h.intervals.values()].some((timer) => timer.delay === 25_000), false, 'close must clear the heartbeat interval')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets[0].open()
  h.sockets[0].message({ type: 'AUTH_REQUIRED' })
  h.sockets[0].close()
  assert.equal(h.authRejectedEvents.length, 0, 'AUTH_REQUIRED must not emit auth rejected')
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [500], 'AUTH_REQUIRED close must reconnect with backoff')
  h.runTimeout(500)
  h.sockets[1].close()
  assert.deepEqual([...h.timeouts.values()].map((timer) => timer.delay), [1000], 'AUTH_REQUIRED reconnects must grow backoff')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
  h.manager.subscribe(() => {})
  h.sockets[0].open()
  h.sockets[0].message({ type: 'AUTH_INVALID' })
  h.sockets[0].close(1008)
  assert.equal(h.authRejectedEvents.length, 1, 'AUTH_INVALID must emit auth rejected once')
  assert.equal(h.serverNotices.length, 0, 'auth rejection must not show a server notice')
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe(() => {})
  h.sockets[0].open()
  h.sockets[0].close(1008)
  assert.equal(h.authRejectedEvents.length, 1, 'close 1008 without a frame must behave as AUTH_INVALID')
  assert.equal(h.timeouts.size, 0)
  assert.equal(h.sockets.length, 1)
}

{
  const h = createHarness()
  h.manager.configure({ url: 'ws://example/ws', token: 'expired-token' })
  h.manager.subscribe(() => {})
  h.sockets[0].open()
  h.sockets[0].message({ type: 'AUTH_INVALID' })
  const socketsAfterReject = h.sockets.length
  h.manager.subscribe(() => {})
  assert.equal(h.sockets.length, socketsAfterReject, 'subscribe after auth rejection must not open a socket')
  assert.equal(h.timeouts.size, 0, 'subscribe after auth rejection must not schedule retries')
}

{
  const h = createHarness()
  openReadySocket(h)
  const planted = 'Observer company scope is not allowed for this user'
  h.sockets[0].message({ type: 'SUBSCRIPTION_INVALID', code: 'SUBSCRIPTION_INVALID', message: planted })
  assert.equal(h.serverNotices.length, 1)
  assert.equal(h.serverNotices[0].text, REALTIME_SERVER_REJECT_NOTICE)
  assert.notEqual(h.serverNotices[0].text, planted)
  assert.equal(h.authRejectedEvents.length, 0)
  assert.equal(h.sockets[0].readyState, 1, 'subscription reject must keep the socket open')
  assert.equal(h.sockets.length, 1)
  assert.equal([...h.timeouts.values()].some((timer) => timer.delay === 500 || timer.delay === 1000), false)

  h.sockets[0].message({ type: 'BAD_MESSAGE', code: 'BAD_MESSAGE', message: 'Message must be JSON' })
  h.sockets[0].message({ type: 'CUSTOM_REJECT', code: 'UNKNOWN_CODE', message: 'planted-unknown' })
  assert.equal(h.serverNotices.length, 3, 'any frame with code must use the same notice branch')
  assert.ok(h.serverNotices.every((notice) => notice.text === REALTIME_SERVER_REJECT_NOTICE))
  assert.ok(h.serverNotices.every((notice) => notice.text !== 'planted-unknown'))
  assert.equal(h.authRejectedEvents.length, 0)
  assert.equal(h.sockets[0].readyState, 1)
  assert.equal(h.sockets.length, 1)
}

{
  const h = createHarness()
  const received = []
  h.manager.configure({ url: 'ws://example/ws', token: 'token' })
  h.manager.subscribe((message) => received.push(message))
  h.sockets[0].open()
  h.sockets[0].message({ type: 'session.ready' })
  h.sockets[0].message({ type: 'ticket.updated', notificationId: 'n-1', ticketId: 'ticket-1' })
  h.sockets[0].message({ type: 'ticket.updated', notificationId: 'n-1', ticketId: 'ticket-1' })
  assert.equal(received.length, 1, 'replayed notification IDs must be delivered only once')

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
  assert.equal(h.serverNotices.length, 1, 'notice frames must also dedupe by notificationId')
}

console.log('Realtime WebSocket resilience checks passed')
