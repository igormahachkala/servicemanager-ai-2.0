import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const moduleCache = new Map()

function resolveLocalTsModule(id, fromFilename) {
  const targetBase = resolve(dirname(fromFilename), id)
  const candidates = [
    targetBase,
    `${targetBase}.ts`,
    `${targetBase}.tsx`,
    resolve(targetBase, 'index.ts'),
    resolve(targetBase, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    if (statSync(candidate).isDirectory()) continue
    return candidate
  }
  throw new Error(`Cannot resolve runtime require(${id}) from ${relative(root, fromFilename)}`)
}

function loadTsModule(relativePath) {
  const filename = resolve(root, relativePath)
  const cached = moduleCache.get(filename)
  if (cached) return cached.exports
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
  moduleCache.set(filename, module)
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (id) => {
      if (id.startsWith('.')) return loadTsModule(relative(root, resolveLocalTsModule(id, filename)))
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
const listUtils = loadTsModule('src/mobile/mobileHomeListUtils.ts')
const push = loadTsModule('src/mobile/mobilePushActivation.ts')
const mobileHomeSource = readFileSync(resolve(root, 'src/mobile/home/MobileHome.tsx'), 'utf8')

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

function homeTicket(id, status, locationId = 'loc-a') {
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
  }
}

function visibleHomeTickets(cards, tab) {
  return listUtils.buildMobileHomeVisibleTickets({
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

{
  assert.match(mobileHomeSource, /queryKey:\s*\[\s*['"]mobile-home-completed-board['"]/)
  assert.match(mobileHomeSource, /status:\s*['"]DONE['"]/)
  assert.match(mobileHomeSource, /includeArchived:\s*true/)
  assert.match(mobileHomeSource, /enabled:\s*boardEnabled\s*&&\s*isOnline\s*&&\s*boardTab\s*===\s*['"]done['"]/)
}

{
  const completed = [
    homeTicket('done-1', 'DONE', 'loc-a'),
    homeTicket('done-2', 'DONE', 'loc-a'),
    homeTicket('done-3', 'DONE', 'loc-b'),
  ]
  const visible = visibleHomeTickets(completed, 'done')
  assert.deepEqual(plain(visible.map((t) => t.id).sort()), ['done-1', 'done-2', 'done-3'])
  const groups = listUtils.groupTicketsByLocation(visible, { renderMode: 'done' })
  assert.equal(groups.length, 2)
  assert.equal(groups.reduce((sum, group) => sum + group.doneTickets, 0), 3)
  assert.equal(groups.reduce((sum, group) => sum + group.tickets.length, 0), 3)
}

{
  const mixed = [homeTicket('new-1', 'NEW', 'loc-a'), homeTicket('done-1', 'DONE', 'loc-a')]
  const visible = visibleHomeTickets(mixed, 'all')
  const groups = listUtils.groupTicketsByLocation(visible)
  assert.deepEqual(plain(groups.flatMap((group) => group.tickets).map((t) => t.id)), ['new-1'])
}

{
  const visible = visibleHomeTickets([homeTicket('done-1', 'DONE', 'loc-a')], 'done')
  const groups = listUtils.groupTicketsByLocation(visible, { renderMode: 'done' })
  assert.equal(visible.length, 1)
  assert.equal(groups.flatMap((group) => group.tickets).length, 1)
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
