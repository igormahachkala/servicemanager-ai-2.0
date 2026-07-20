import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadTsModule(relativePath) {
  const filename = resolve(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (id) => {
      throw new Error(`Unexpected runtime require(${id}) from ${relativePath}`)
    },
    console,
    setTimeout,
    clearTimeout,
  })
  vm.runInContext(output, context, { filename })
  return module.exports
}

const filters = loadTsModule('src/mobile/mobileHomeBoardFilters.ts')
const push = loadTsModule('src/mobile/mobilePushActivation.ts')

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function ticket(id, status, assignedTechnicianId, createdByUserId = 'creator') {
  return {
    id,
    status,
    assignedTechnicianId,
    assignedTechnician: assignedTechnicianId ? { id: assignedTechnicianId, email: `${assignedTechnicianId}@test.local` } : null,
    createdByUserId,
  }
}

function activeMine(tickets, role = 'TECHNICIAN') {
  return filters
    .ticketsForMobileMyPage(tickets, 'active', 'me', role)
    .filter(filters.isActiveMobileMyTicket)
    .map((t) => t.id)
}

{
  const tickets = [
    ticket('new-assigned', 'NEW', 'me'),
    ticket('assigned', 'ASSIGNED', 'me'),
    ticket('in-progress', 'IN_PROGRESS', 'me'),
    ticket('awaiting', 'AWAITING_ACCEPTANCE', 'me'),
    ticket('done', 'DONE', 'me'),
    ticket('canceled', 'CANCELED', 'me'),
    ticket('other-tech', 'ASSIGNED', 'other'),
  ]
  assert.deepEqual(plain(activeMine(tickets)), ['new-assigned', 'assigned', 'in-progress', 'awaiting'])
}

{
  const tickets = [
    ticket('master-assigned', 'ASSIGNED', 'me', 'someone-else'),
    ticket('master-created', 'NEW', 'other', 'me'),
    ticket('master-other', 'IN_PROGRESS', 'other', 'someone-else'),
  ]
  assert.deepEqual(plain(activeMine(tickets, 'MASTER')), ['master-assigned', 'master-created'])
}

{
  const tickets = [
    ticket('mine', 'ASSIGNED', 'me'),
    ticket('another-technician', 'ASSIGNED', 'other'),
  ]
  assert.deepEqual(plain(activeMine(tickets)), ['mine'])
}

{
  assert.equal(filters.isActiveMobileMyTicket(ticket('done', 'DONE', 'me')), false)
  assert.equal(filters.isActiveMobileMyTicket(ticket('canceled', 'CANCELED', 'me')), false)
  assert.equal(filters.isActiveMobileMyTicket(ticket('awaiting', 'AWAITING_ACCEPTANCE', 'me')), true)
}

function makeSub(id = 'sub') {
  return { endpoint: `https://push.example/${id}` }
}

async function runEnable(overrides = {}) {
  const calls = []
  const deps = {
    requestPermission: async () => 'granted',
    registerServiceWorker: async () => ({ scope: '/' }),
    getExistingSubscription: async () => null,
    subscribeToPush: async () => makeSub('new'),
    serializeSubscription: (sub) => ({ endpoint: sub.endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } }),
    saveSubscription: async (payload) => calls.push(['save', payload.endpoint, payload.platform]),
    updatePreferences: async (patch) => {
      calls.push(['prefs', patch.chat, patch.news])
      return { ...push.PUSH_ENABLE_PREFS, ...patch }
    },
    refreshCanonicalState: async () => calls.push(['refresh']),
    ...overrides,
  }
  const result = await push.enablePushNotifications({
    vapidPublicKey: 'vapid-key',
    platform: 'android',
    deps,
    timeoutMs: 200,
  })
  return { result, calls }
}

{
  const { result, calls } = await runEnable()
  assert.equal(result.ok, true)
  assert.equal(result.subscribed, true)
  assert.deepEqual(calls.map((c) => c[0]), ['save', 'prefs', 'refresh'])
}

{
  const existing = makeSub('existing')
  const { result, calls } = await runEnable({
    getExistingSubscription: async () => existing,
    subscribeToPush: async () => {
      throw new Error('must reuse existing subscription')
    },
  })
  assert.equal(result.ok, true)
  assert.equal(calls[0][1], existing.endpoint)
}

{
  const { result, calls } = await runEnable({
    getExistingSubscription: async () => makeSub('partial-existing'),
  })
  assert.equal(result.ok, true)
  assert.equal(calls[0][1], 'https://push.example/partial-existing')
  assert.equal(calls[1][0], 'prefs')
}

{
  const { result, calls } = await runEnable({
    saveSubscription: async () => {
      throw new Error('backend down')
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorKind, 'backend_error')
  assert.equal(result.subscribed, true)
  assert.deepEqual(calls, [])
}

{
  const { result } = await runEnable({
    requestPermission: async () => 'denied',
  })
  assert.equal(result.ok, false)
  assert.equal(result.errorKind, 'permission_denied')
  assert.equal(result.subscribed, false)
}

console.log('verify-mobile-rc-fixes: PASS')
