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

function loadTsModule(relativePath, globals = {}) {
  const filename = resolve(root, relativePath)
  const cached = moduleCache.get(filename)
  if (cached) return cached.module.exports

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
      if (id.startsWith('.')) return loadTsModule(relative(root, resolveLocalTsModule(id, filename)), globals)
      throw new Error(`Unexpected runtime require(${id}) from ${relative(root, filename)}`)
    },
    console,
    URL,
    URLSearchParams,
    ...globals,
  })
  moduleCache.set(filename, { module, context })
  vm.runInContext(output, context, { filename })
  return module.exports
}

const navigation = loadTsModule('src/lib/notificationNavigation.ts')
const returnTo = loadTsModule('src/lib/returnToNavigation.ts')

{
  const target = {
    kind: 'ticket',
    ticketId: 'ticket-42',
    section: 'comments',
    linkedClientCompanyId: 'client-1',
    sourceEventId: 'event-1',
  }
  assert.equal(
    navigation.resolveNotificationNavigationTargetPath(target, 'desktop'),
    '/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
  )
  assert.equal(
    navigation.resolveNotificationNavigationTargetPath(target, 'mobile'),
    '/m/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
  )
  assert.equal(
    navigation.resolveNotificationNavigationTargetPath(target, 'max'),
    '/max/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
  )
}

{
  assert.equal(
    navigation.resolveNotificationSourcePath(
      {
        type: 'ticket.attachment_uploaded',
        entityType: 'Ticket',
        entityId: 'ticket-attachment',
      },
      'mobile',
    ),
    '/m/tickets/ticket-attachment?section=attachments',
  )
  assert.equal(
    navigation.resolveNotificationSourcePath(
      {
        type: 'ticket.awaiting_acceptance',
        entityType: 'Ticket',
        entityId: 'ticket-acceptance',
      },
      'desktop',
    ),
    '/tickets/ticket-acceptance?section=acceptance',
  )
  assert.equal(navigation.resolveNotificationSourcePath({ entityType: 'Company', entityId: 'company-1' }, 'desktop'), null)
}

{
  assert.equal(returnTo.sanitizeInternalAppPath('/tickets/ticket-42?section=comments#top'), '/tickets/ticket-42?section=comments#top')
  assert.equal(
    returnTo.loginPathWithReturnTo('/m/tickets/ticket-42?section=history'),
    '/login?returnTo=%2Fm%2Ftickets%2Fticket-42%3Fsection%3Dhistory',
  )
  assert.equal(
    returnTo.workspacePathWithReturnTo('/max/tickets/ticket-42?section=actions'),
    '/workspaces?returnTo=%2Fmax%2Ftickets%2Fticket-42%3Fsection%3Dactions',
  )
}

{
  const rejected = [
    'https://evil.example/tickets/ticket-42',
    'http://evil.example/tickets/ticket-42',
    '//evil.example/tickets/ticket-42',
    '/\\evil.example\\tickets\\ticket-42',
    'javascript:alert(1)',
    '/login?returnTo=/tickets/ticket-42',
    '/request-access',
    '/unknown/ticket-42',
  ]
  for (const candidate of rejected) {
    assert.equal(returnTo.sanitizeInternalAppPath(candidate), '', `must reject ${candidate}`)
  }
}

{
  assert.equal(
    returnTo.getReturnToFromSearch('?returnTo=%2Ftickets%2Fticket-42%3Fsection%3Dcomments'),
    '/tickets/ticket-42?section=comments',
  )
  assert.equal(returnTo.getReturnToFromSearch('?returnTo=https%3A%2F%2Fevil.example'), '')
}

const swSource = readFileSync(resolve(root, 'public/sw.js'), 'utf8')
assert.match(swSource, /navigationTarget/)
assert.match(swSource, /canonicalTicketTarget/)
assert.match(swSource, /postMessage\(\{\s*type:\s*['"]push-navigate['"]/s)

console.log('verify-notification-navigation: PASS')
