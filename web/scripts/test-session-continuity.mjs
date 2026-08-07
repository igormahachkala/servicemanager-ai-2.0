import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadSessionModule() {
  const filename = resolve(root, 'src/lib/sessionContinuity.ts')
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
    navigator: { onLine: true },
    URLSearchParams,
  })
  vm.runInContext(output, context, { filename })
  return { session: module.exports, context }
}

const { session, context } = loadSessionModule()

function httpError(status) {
  const error = new Error(`HTTP ${status}`)
  error.status = status
  return error
}

{
  assert.equal(session.resolveSessionState({ hasSessionData: true, isError: false, error: null }), 'AUTHENTICATED')
}

{
  const err = httpError(401)
  assert.equal(session.classifySessionError(err), 'AUTH_EXPIRED')
  assert.equal(session.shouldClearTokenForSessionError(err), true)
  assert.equal(session.shouldRetrySessionCheck(0, err), false)
}

for (const status of [500, 502, 503, 504]) {
  const err = httpError(status)
  assert.equal(session.classifySessionError(err), 'BACKEND_UNAVAILABLE')
  assert.equal(session.shouldClearTokenForSessionError(err), false)
  assert.equal(session.shouldRetrySessionCheck(0, err), true)
}

{
  const err = new TypeError('Failed to fetch')
  assert.equal(session.classifySessionError(err), 'NETWORK_ERROR')
  assert.equal(session.shouldClearTokenForSessionError(err), false)
  assert.equal(session.shouldRetrySessionCheck(0, err), true)
}

{
  context.navigator.onLine = false
  const err = new Error('temporary failure')
  assert.equal(session.classifySessionError(err), 'NETWORK_ERROR')
  assert.equal(session.shouldClearTokenForSessionError(err), false)
  context.navigator.onLine = true
}

{
  const err = new Error('unexpected')
  assert.equal(session.classifySessionError(err), 'UNKNOWN_ERROR')
  assert.equal(session.shouldClearTokenForSessionError(err), false)
  assert.equal(session.shouldRetrySessionCheck(4, err), true)
  assert.equal(session.shouldRetrySessionCheck(5, err), false)
}

{
  assert.equal(session.sessionCheckRetryDelay(0), 1000)
  assert.equal(session.sessionCheckRetryDelay(1), 2000)
  assert.equal(session.sessionCheckRetryDelay(10), 30000)
}

{
  const loginPath = session.buildLoginPathWithReturnTo('/tickets/abc', '?tab=chat', '#history')
  assert.equal(loginPath, '/login?returnTo=%2Ftickets%2Fabc%3Ftab%3Dchat%23history')
  assert.equal(session.buildLoginPathWithReturnTo('/login'), '/login')
  assert.equal(session.readSafeLoginReturnTo('/m/tickets/1?tab=chat'), '/m/tickets/1?tab=chat')
  assert.equal(session.readSafeLoginReturnTo('https://example.com/m'), '')
  assert.equal(session.readSafeLoginReturnTo('//example.com/m'), '')
  assert.equal(session.readSafeLoginReturnTo('/logout'), '')
}

for (const file of ['src/ui/Shell.tsx', 'src/views/WorkspaceSelectorPage.tsx', 'src/mobile/MobileShell.tsx']) {
  const source = readFileSync(resolve(root, file), 'utf8')
  assert.match(source, /sessionState !== 'AUTH_EXPIRED'/, `${file} must only clear token after confirmed AUTH_EXPIRED`)
  assert.doesNotMatch(
    source,
    /if\s*\(\s*!?meQ\.isError\s*\)\s*return[\s\S]{0,80}api\.clearToken\(\)/,
    `${file} must not use broad meQ.isError -> clearToken`,
  )
}

console.log('test-session-continuity: PASS')
