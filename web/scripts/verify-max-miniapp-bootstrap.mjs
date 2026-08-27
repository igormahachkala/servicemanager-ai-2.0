import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const moduleCache = new Map()

function loadTypeScript() {
  const candidates = [
    'typescript',
    resolve('/private/tmp/sma-notification-max-final-rc-042/web/node_modules/typescript'),
    resolve('/private/tmp/sma-stabilization-final-candidate-003/web/node_modules/typescript'),
    resolve('/Users/igor/projects/sma-service/web/node_modules/typescript'),
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

function loadTsModule(relativePath) {
  const filename = resolve(root, relativePath)
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
  const loaded = {
    module,
    context: vm.createContext({
      module,
      exports: module.exports,
      require: (id) => {
        if (id.startsWith('.')) {
          return loadTsModule(relative(root, resolveLocalTsModule(id, filename))).module.exports
        }
        throw new Error(`Unexpected runtime require(${id}) from ${relative(root, filename)}`)
      },
      console,
      setTimeout,
      clearTimeout,
      URL,
      URLSearchParams,
    }),
  }
  moduleCache.set(filename, loaded)
  vm.runInContext(output, loaded.context, { filename })
  return loaded
}

function setDom(windowValue, documentValue) {
  for (const loaded of moduleCache.values()) {
    loaded.context.window = windowValue
    loaded.context.document = documentValue
  }
}

class FakeScript {
  constructor() {
    this.attributes = new Map()
    this.listeners = new Map()
    this.src = ''
    this.async = false
    this.parentNode = null
    this.readyState = ''
  }

  setAttribute(key, value) {
    this.attributes.set(key, String(value))
  }

  getAttribute(key) {
    return this.attributes.get(key) ?? null
  }

  addEventListener(type, handler) {
    const current = this.listeners.get(type) || []
    current.push(handler)
    this.listeners.set(type, current)
  }

  removeEventListener(type, handler) {
    const current = this.listeners.get(type) || []
    this.listeners.set(type, current.filter((item) => item !== handler))
  }

  dispatch(type) {
    for (const handler of this.listeners.get(type) || []) handler()
  }
}

class FakeDocument {
  constructor(onAppend = null) {
    this.scripts = []
    this.onAppend = onAppend
    this.head = {
      appendChild: (script) => {
        script.parentNode = this.head
        this.scripts.push(script)
        this.onAppend?.(script)
      },
      removeChild: (script) => {
        this.scripts = this.scripts.filter((item) => item !== script)
        script.parentNode = null
      },
    }
  }

  querySelector(selector) {
    if (selector !== 'script[data-max-bridge]') return null
    return this.scripts.find((script) => script.getAttribute('data-max-bridge') !== null) || null
  }

  createElement(tag) {
    assert.equal(tag, 'script')
    return new FakeScript()
  }
}

const maxBridgeLoaded = loadTsModule('src/max/maxBridge.ts')
const maxBootstrapLoaded = loadTsModule('src/max/maxBootstrap.ts')
const maxBridge = maxBridgeLoaded.module.exports
const maxBootstrap = maxBootstrapLoaded.module.exports

async function assertRejectsWithTimeout(promise) {
  await assert.rejects(promise, /MAX Bridge/)
}

{
  setDom({ WebApp: { initData: 'signed' } }, new FakeDocument())
  await maxBridge.loadMaxBridgeScript({ timeoutMs: 10 })
}

{
  const windowValue = {}
  const documentValue = new FakeDocument((script) => {
    setTimeout(() => {
      windowValue.WebApp = { initData: 'signed' }
      script.readyState = 'complete'
      script.dispatch('load')
    }, 5)
  })
  setDom(windowValue, documentValue)
  await maxBridge.loadMaxBridgeScript({ timeoutMs: 50 })
  assert.equal(windowValue.WebApp.initData, 'signed')
}

{
  const documentValue = new FakeDocument((script) => {
    setTimeout(() => script.dispatch('error'), 5)
  })
  setDom({}, documentValue)
  await assertRejectsWithTimeout(maxBridge.loadMaxBridgeScript({ timeoutMs: 50 }))
}

{
  const documentValue = new FakeDocument()
  setDom({}, documentValue)
  await assertRejectsWithTimeout(maxBridge.loadMaxBridgeScript({ timeoutMs: 5 }))
  assert.equal(documentValue.scripts.length, 0)
}

{
  const documentValue = new FakeDocument((script) => {
    setTimeout(() => {
      script.readyState = 'complete'
      script.dispatch('load')
    }, 5)
  })
  setDom({}, documentValue)
  await maxBridge.loadMaxBridgeScript({ timeoutMs: 50 })
  assert.equal(maxBridge.isMaxEnvironment(), false)
  assert.equal(maxBootstrap.isMaxContextAvailable(maxBridge.getMaxEnvironmentContext()), false)
}

{
  setDom({ WebApp: { initData: '', initDataUnsafe: {} } }, new FakeDocument())
  assert.equal(maxBridge.isMaxEnvironment(), false)

  setDom({ WebApp: { initData: '', initDataUnsafe: { user: {} } } }, new FakeDocument())
  assert.equal(maxBridge.isMaxEnvironment(), true)

  setDom({ WebApp: { initData: '', initDataUnsafe: { chat: {} } } }, new FakeDocument())
  assert.equal(maxBridge.isMaxEnvironment(), true)

  setDom({ WebApp: { initData: '', initDataUnsafe: { start_param: 'ticket_42' } } }, new FakeDocument())
  assert.equal(maxBridge.isMaxEnvironment(), true)
}

{
  assert.equal(maxBootstrap.resolveMaxReturnTo({ pathname: '/max', search: '?startapp=ticket_42', startParam: 'ticket_42' }), '/max/tickets/42')
  assert.equal(maxBootstrap.resolveMaxReturnTo({ pathname: '/max/tickets/42', search: '?section=comments', hash: '#top' }), '/max/tickets/42?section=comments#top')
  assert.equal(maxBootstrap.resolveMaxReturnTo({ pathname: '/login', search: '?returnTo=https%3A%2F%2Fevil.example' }), '/max')
}

{
  assert.equal(maxBootstrap.hasSmaSessionToken(null), false)
  assert.equal(maxBootstrap.hasSmaSessionToken(''), false)
  assert.equal(maxBootstrap.hasSmaSessionToken('token'), true)
  assert.equal(maxBootstrap.classifyMaxAuthFailure({ status: 401 }), 'unauthenticated')
  assert.equal(maxBootstrap.classifyMaxAuthFailure({ status: 403 }), 'unauthenticated')
  assert.equal(maxBootstrap.classifyMaxAuthFailure(new Error('network failed')), 'temporary_error')
  assert.equal(maxBootstrap.classifyMaxAuthFailure({ name: 'ApiTimeoutError' }), 'temporary_error')
}

{
  const returnTo = loadTsModule('src/lib/returnToNavigation.ts').module.exports
  assert.equal(returnTo.getReturnToFromSearch('?next=%2Fmax%2F&mode=mobile'), '/max/')
  assert.equal(returnTo.getReturnToFromSearch('?returnTo=%2Fmax%2Ftickets%2F42&next=%2Fm'), '/max/tickets/42')
}

{
  const maxAppSource = readFileSync(resolve(root, 'src/max/MaxApp.tsx'), 'utf8')
  const maxBootstrapSource = readFileSync(resolve(root, 'src/max/maxBootstrap.ts'), 'utf8')
  for (const state of [
    'loading_bridge',
    'detecting_context',
    'checking_auth',
    'unauthenticated',
    'authenticated',
    'context_unavailable',
    'temporary_error',
  ]) {
    assert.match(maxAppSource, new RegExp(`['"]${state}['"]`))
  }
  assert.match(maxAppSource, /api\.meWithTimeout\(MAX_AUTH_TIMEOUT_MS\)/)
  assert.match(maxAppSource, /api\.clearToken\(\)/)
  assert.match(maxAppSource, /api\.loginPathWithReturnTo\(returnTo\)/)
  assert.match(maxAppSource, /setRetryNonce/)
  assert.match(maxBootstrapSource, /Не удалось загрузить приложение/)
  assert.match(maxAppSource, /Повторить/)
  assert.match(maxAppSource, /Открыть ServiceManager/)
}

{
  const apiSource = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8')
  const loginPageSource = readFileSync(resolve(root, 'src/views/LoginPage.tsx'), 'utf8')
  const workspaceSource = readFileSync(resolve(root, 'src/views/WorkspaceSelectorPage.tsx'), 'utf8')
  const maxTicketEntrySource = readFileSync(resolve(root, 'src/max/MaxTicketEntry.tsx'), 'utf8')

  assert.match(apiSource, /timeoutMs\?: number/)
  assert.match(apiSource, /AbortController/)
  assert.match(apiSource, /ApiTimeoutError/)
  assert.match(apiSource, /LOGIN_REQUEST_TIMEOUT_MS/)
  assert.match(apiSource, /meWithTimeout\(timeoutMs: number\)/)
  assert.match(loginPageSource, /api\.isApiTimeoutError\(err\)/)
  assert.match(workspaceSource, /returnTo\.startsWith\(['"]\/max['"]\)/)
  assert.match(maxTicketEntrySource, /<Navigate to=\{target\} replace \/>/)
  assert.doesNotMatch(maxTicketEntrySource, /Открываем заявку/)
}

console.log('verify-max-miniapp-bootstrap: PASS')
