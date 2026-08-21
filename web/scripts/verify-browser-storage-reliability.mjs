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
  const moduleCache = new Map()

  function load(relativeModulePath) {
    const filename = resolve(root, relativeModulePath)
    const cached = moduleCache.get(filename)
    if (cached) return cached

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
        if (id.startsWith('.')) {
          return load(relative(root, resolveLocalTsModule(id, filename))).module.exports
        }
        throw new Error(`Unexpected runtime require(${id}) from ${relative(root, filename)}`)
      },
      console,
      DOMException,
      ...globals,
    })
    const loaded = { module, context }
    moduleCache.set(filename, loaded)
    vm.runInContext(output, context, { filename })
    return loaded
  }

  return load(relativePath)
}

class FakeStorage {
  constructor(options = {}) {
    this.map = new Map(Object.entries(options.initial || {}))
    this.setError = options.setError || null
    this.getError = options.getError || null
    this.removeError = options.removeError || null
  }

  get length() {
    return this.map.size
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null
  }

  getItem(key) {
    if (this.getError) throw this.getError
    return this.map.has(key) ? this.map.get(key) : null
  }

  setItem(key, value) {
    if (this.setError) throw this.setError
    this.map.set(key, String(value))
  }

  removeItem(key) {
    if (this.removeError) throw this.removeError
    this.map.delete(key)
  }
}

const loaded = loadTsModule('src/lib/browserStorage.ts', { window: undefined })
const storage = loaded.module.exports

function setWindow(windowValue) {
  loaded.context.window = windowValue
}

function makeWindow(localStorage = new FakeStorage(), sessionStorage = new FakeStorage()) {
  return { localStorage, sessionStorage }
}

{
  const local = new FakeStorage()
  setWindow(makeWindow(local))
  assert.equal(storage.safeSetItem('local', 'sm_token', 'token').ok, true)
  assert.equal(storage.safeGetItem('local', 'sm_token', ''), 'token')
}

{
  const local = new FakeStorage({
    setError: new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
  })
  setWindow(makeWindow(local))
  const result = storage.safeSetItem('local', 'sm_token', 'token')
  assert.equal(result.ok, false)
  assert.equal(result.error.kind, 'quota')
  assert.equal(result.error.message, storage.BROWSER_STORAGE_ERROR_MESSAGE)
  assert.doesNotMatch(result.error.message, /QuotaExceededError|quota has been exceeded/i)
  assert.throws(() => storage.requireSetItem('local', 'sm_token', 'token'), storage.BrowserStorageError)
}

{
  const failingWindow = {}
  Object.defineProperty(failingWindow, 'localStorage', {
    get() {
      throw new DOMException('blocked', 'SecurityError')
    },
  })
  Object.defineProperty(failingWindow, 'sessionStorage', {
    value: new FakeStorage(),
  })
  setWindow(failingWindow)
  const result = storage.safeSetItem('local', 'sm_token', 'token')
  assert.equal(result.ok, false)
  assert.equal(result.error.kind, 'security')
  assert.equal(storage.safeGetItem('local', 'sm_token', 'fallback'), 'fallback')
}

{
  setWindow({})
  const result = storage.safeSetItem('local', 'sm_token', 'token')
  assert.equal(result.ok, false)
  assert.equal(result.error.kind, 'unavailable')
  assert.equal(storage.safeGetItem('local', 'sm_token', 'fallback'), 'fallback')
}

{
  assert.equal(storage.classifyBrowserStorageError(new DOMException('nope', 'NotSupportedError')), 'not-supported')
  assert.equal(storage.classifyBrowserStorageError(new DOMException('blocked', 'SecurityError')), 'security')
}

{
  const local = new FakeStorage({ initial: { sm_token: 'old', sm_user_role: 'TECHNICIAN' } })
  setWindow(makeWindow(local))
  const snapshot = storage.snapshotStorageItems('local', ['sm_token', 'sm_user_role', 'missing'])
  storage.requireSetItem('local', 'sm_token', 'new')
  storage.restoreStorageSnapshot('local', snapshot)
  assert.equal(local.getItem('sm_token'), 'old')
  assert.equal(local.getItem('sm_user_role'), 'TECHNICIAN')
  assert.equal(local.getItem('missing'), null)
}

{
  const local = new FakeStorage({
    initial: {
      obsolete: '1',
      'sma.mobileGuidedTour.v1.user': 'completed',
      keep: '1',
    },
  })
  setWindow(makeWindow(local))
  const result = storage.applyStorageSchemaVersion({
    versionKey: 'sma_storage_schema_version',
    currentVersion: '2',
    obsoleteLocalStorageKeys: ['obsolete'],
    obsoleteLocalStoragePrefixes: ['sma.mobileGuidedTour.v1.'],
  })
  assert.equal(result.ok, true)
  assert.equal(local.getItem('obsolete'), null)
  assert.equal(local.getItem('sma.mobileGuidedTour.v1.user'), null)
  assert.equal(local.getItem('keep'), '1')
  assert.equal(local.getItem('sma_storage_schema_version'), '2')
}

{
  const loginPage = readFileSync(resolve(root, 'src/views/LoginPage.tsx'), 'utf8')
  const loginCall = loginPage.indexOf('const result = await api.login')
  const persistCall = loginPage.indexOf('api.persistLoginSession(result)')
  assert.ok(loginCall > -1, 'LoginPage must call backend login')
  assert.ok(persistCall > loginCall, 'session persistence must happen after backend login success')
  assert.match(loginPage, /api\.isLoginSessionStorageError\(err\)/)
  assert.match(loginPage, /api\.LOGIN_SESSION_STORAGE_ERROR_MESSAGE/)
}

{
  const apiSource = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8')
  assert.match(apiSource, /function persistLoginSessionSafely/)
  assert.match(apiSource, /snapshotLocalStorage\(LOGIN_SESSION_STORAGE_KEYS\)/)
  assert.match(apiSource, /restoreLocalStorageSnapshot\(snapshot\)/)
  assert.doesNotMatch(apiSource, /\b(?:window\.)?(?:localStorage|sessionStorage)\s*\./)
}

{
  const routerSource = readFileSync(resolve(root, 'src/router.tsx'), 'utf8')
  assert.match(routerSource, /api\.clearClientBrowserStorage\(\)/)
  assert.match(routerSource, /api\.initializeBrowserStorage\(\)/)
  assert.doesNotMatch(routerSource, /\b(?:window\.)?(?:localStorage|sessionStorage)\s*\.(?:clear|setItem|getItem|removeItem)/)
}

{
  const mobileHome = readFileSync(resolve(root, 'src/mobile/mobileHomeListUtils.ts'), 'utf8')
  const offlineQueue = readFileSync(resolve(root, 'src/mobile/offlineQueue.ts'), 'utf8')
  assert.match(mobileHome, /safeReadJson/)
  assert.match(mobileHome, /safeWriteJson/)
  assert.match(offlineQueue, /browserStorage/)
}

console.log('browser storage reliability checks passed')
