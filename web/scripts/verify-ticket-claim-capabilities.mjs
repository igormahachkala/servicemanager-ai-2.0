import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function loadTypeScript() {
  const candidates = [
    'typescript',
    resolve('/Users/igor/projects/sma-service/web/node_modules/typescript'),
    resolve('/private/tmp/sma-stabilization-final-candidate-003/web/node_modules/typescript'),
  ]
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      // Try the next local dependency location.
    }
  }
  throw new Error('Cannot load TypeScript. Run npm install in web/ before this focused check.')
}

const ts = loadTypeScript()
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
  })
  vm.runInContext(output, context, { filename })
  return module.exports
}

const capability = loadTsModule('src/lib/ticketActionCapabilities.ts')
const ops = loadTsModule('src/lib/ticketOperationalModel.ts')
const home = loadTsModule('src/mobile/home/utils.ts')

function ticket(overrides = {}) {
  return {
    id: 'ticket-1',
    status: 'NEW',
    assignedTechnician: null,
    assignedTechnicianId: null,
    canClaim: undefined,
    canClaimByCurrentUser: undefined,
    assignmentRequestedByCurrentUser: false,
    meta: {
      canClaim: undefined,
      canClaimByCurrentUser: undefined,
      assignmentRequestedByCurrentUser: false,
      availableActions: {
        canClaim: false,
        canStart: false,
        canComplete: false,
        canClose: false,
        canRequestAssignment: false,
      },
    },
    ...overrides,
  }
}

{
  const providerAdminOwnNewTicket = ticket({
    meta: {
      availableActions: {
        canClaim: false,
        canStart: true,
        canComplete: false,
        canClose: false,
        canRequestAssignment: false,
      },
      canClaim: false,
      canClaimByCurrentUser: false,
      canRequestAssignment: false,
    },
  })
  assert.equal(capability.readBackendCanClaim(providerAdminOwnNewTicket), false)
  assert.equal(capability.canOfferTicketClaimAction(providerAdminOwnNewTicket), false)
  assert.equal(
    ops.computePrimaryTicketAction({
      ticket: providerAdminOwnNewTicket,
      canClaim: false,
      canChangeStatus: true,
      availableStatusTransitions: ['IN_PROGRESS'],
    })?.kind,
    'in_progress',
  )
}

{
  const eligibleTechnician = ticket({ meta: { availableActions: { canClaim: true } } })
  assert.equal(capability.readBackendCanClaim(eligibleTechnician), true)
  assert.equal(capability.canOfferTicketClaimAction(eligibleTechnician), true)
  assert.equal(
    ops.computePrimaryTicketAction({
      ticket: eligibleTechnician,
      canClaim: true,
      canChangeStatus: false,
      availableStatusTransitions: [],
    })?.kind,
    'claim',
  )
}

{
  const eligibleMaster = ticket({ canClaim: true, meta: null })
  assert.equal(home.getPrimaryActionLabel(eligibleMaster, 'master-user', 'MASTER'), 'Взять')
  const blockedMaster = ticket({ canClaim: false, meta: null })
  assert.equal(home.getPrimaryActionLabel(blockedMaster, 'master-user', 'MASTER'), null)
}

{
  const alreadyAssigned = ticket({
    assignedTechnicianId: 'tech-1',
    assignedTechnician: { id: 'tech-1' },
    meta: { availableActions: { canClaim: true } },
  })
  assert.equal(capability.canOfferTicketClaimAction(alreadyAssigned), false)
}

{
  const shiftPolicyBlocked = ticket({
    meta: {
      availableActions: { canClaim: false },
      availableActionHints: { canClaim: 'Откройте смену' },
    },
  })
  assert.equal(capability.canOfferTicketClaimAction(shiftPolicyBlocked), false)

  const shiftPolicyAllowed = ticket({
    meta: {
      availableActions: { canClaim: true },
      availableActionHints: { canClaim: null },
    },
  })
  assert.equal(capability.canOfferTicketClaimAction(shiftPolicyAllowed), true)
}

{
  const legacyMetaAllowed = ticket({ meta: { canClaimByCurrentUser: true } })
  assert.equal(capability.canOfferTicketClaimAction(legacyMetaAllowed), true)

  const failClosedOverride = ticket({
    canClaim: true,
    meta: { canClaim: true, availableActions: { canClaim: false } },
  })
  assert.equal(capability.canOfferTicketClaimAction(failClosedOverride), false)
}

{
  const requestOnly = ticket({ canRequestAssignment: true, meta: null })
  assert.equal(home.getPrimaryActionLabel(requestOnly, 'tech-user', 'TECHNICIAN'), 'Запросить назначение')
  assert.equal(home.getPrimaryActionLabel(requestOnly, 'admin-user', 'ADMIN'), null)
}

{
  const ticketPageSource = readFileSync(resolve(root, 'src/views/TicketPage.tsx'), 'utf8')
  const actionsPanelSource = readFileSync(resolve(root, 'src/components/ticket-card-v2/TicketActionsPanel.tsx'), 'utf8')
  const mobileTicketSource = readFileSync(resolve(root, 'src/mobile/MobileTicketPage.tsx'), 'utf8')

  assert.doesNotMatch(ticketPageSource, /assignTicket\(ticketId,\s*meQ\.data\.id/)
  assert.doesNotMatch(actionsPanelSource, /showSelfAssign|Взять заявку себе/)
  assert.doesNotMatch(mobileTicketSource, /id:\s*['"]self-assign['"]|Взять заявку себе/)
  assert.doesNotMatch(mobileTicketSource, /assignM\.mutate\(\{\s*technicianId:\s*meQ\.data\.id/)
}

console.log('ticket claim capability checks passed')
