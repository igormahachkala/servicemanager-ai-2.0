import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function makeStorage() {
  const map = new Map()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    dump: () => Object.fromEntries(map.entries()),
  }
}

function loadApi(fetchImpl) {
  const filename = resolve(root, 'src/lib/api.ts')
  const source = readFileSync(filename, 'utf8')
    .replace(/^\uFEFF/, '')
    .replaceAll('import.meta.env', '({ DEV: false, VITE_API_BASE_URL: "https://api.example.test" })')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const localStorage = makeStorage()
  const context = vm.createContext({
    module,
    exports: module.exports,
    localStorage,
    window: {
      location: { origin: 'https://servicemanagerai.ru', search: '' },
    },
    fetch: fetchImpl,
    URL,
    URLSearchParams,
    console,
  })
  vm.runInContext(output, context, { filename })
  return { api: module.exports, localStorage }
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  }
}

function mePayload() {
  return {
    id: 'user-1',
    email: 'tech@example.test',
    role: 'TECHNICIAN',
    companyId: 'company-1',
    companyName: 'Компания',
    isActive: true,
  }
}

{
  const calls = []
  const { api } = loadApi(async (url, init) => {
    calls.push({ url, init: { ...init, headers: { ...(init?.headers || {}) } } })
    if (url.endsWith('/auth/me') && calls.filter((c) => c.url.endsWith('/auth/me')).length === 1) {
      assert.equal(init.credentials, 'include')
      assert.equal(init.headers.Authorization, 'Bearer old-access')
      return jsonResponse(401, { message: 'Unauthorized' })
    }
    if (url.endsWith('/auth/refresh')) {
      assert.equal(init.credentials, 'include')
      assert.equal(init.headers.Authorization, undefined)
      return jsonResponse(200, { access_token: 'new-access', user: mePayload() })
    }
    if (url.endsWith('/auth/me')) {
      assert.equal(init.headers.Authorization, 'Bearer new-access')
      return jsonResponse(200, mePayload())
    }
    throw new Error(`Unexpected URL ${url}`)
  })

  api.setToken('old-access')
  const result = await api.me()
  assert.equal(result.email, 'tech@example.test')
  assert.equal(api.getToken(), 'new-access')
  assert.equal(calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 1)
}

{
  let refreshCount = 0
  const { api } = loadApi(async (url, init) => {
    if (url.endsWith('/auth/me') && init.headers.Authorization === 'Bearer old-access') {
      return jsonResponse(401, { message: 'Unauthorized' })
    }
    if (url.endsWith('/auth/refresh')) {
      refreshCount += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return jsonResponse(200, { access_token: 'new-access', user: mePayload() })
    }
    if (url.endsWith('/auth/me') && init.headers.Authorization === 'Bearer new-access') {
      return jsonResponse(200, mePayload())
    }
    throw new Error(`Unexpected request ${url} ${init.headers.Authorization}`)
  })

  api.setToken('old-access')
  await Promise.all([api.me(), api.me(), api.me()])
  assert.equal(refreshCount, 1)
  assert.equal(api.getToken(), 'new-access')
}

{
  const { api } = loadApi(async (url) => {
    if (url.endsWith('/auth/me')) return jsonResponse(401, { message: 'Unauthorized' })
    if (url.endsWith('/auth/refresh')) throw new TypeError('Failed to fetch')
    throw new Error(`Unexpected URL ${url}`)
  })

  api.setToken('old-access')
  await assert.rejects(api.me(), /Failed to fetch/)
  assert.equal(api.getToken(), 'old-access')
}

{
  const { api } = loadApi(async (url) => {
    if (url.endsWith('/auth/me')) return jsonResponse(401, { message: 'Unauthorized' })
    if (url.endsWith('/auth/refresh')) return jsonResponse(503, { message: 'deploy in progress' })
    throw new Error(`Unexpected URL ${url}`)
  })

  api.setToken('old-access')
  await assert.rejects(api.me(), /deploy in progress/)
  assert.equal(api.getToken(), 'old-access')
}

{
  const { api } = loadApi(async (url) => {
    if (url.endsWith('/auth/me')) return jsonResponse(401, { message: 'Unauthorized' })
    if (url.endsWith('/auth/refresh')) return jsonResponse(401, { message: 'Refresh session is invalid' })
    throw new Error(`Unexpected URL ${url}`)
  })

  api.setToken('old-access')
  await assert.rejects(api.me(), /Refresh session is invalid/)
  assert.equal(api.getToken(), '')
}

{
  const { api } = loadApi(async (url, init) => {
    if (url.endsWith('/auth/logout')) {
      assert.equal(init.credentials, 'include')
      return jsonResponse(200, { ok: true, revoked: 1 })
    }
    throw new Error(`Unexpected URL ${url}`)
  })

  api.setToken('access-token')
  await api.logout()
  assert.equal(api.getToken(), '')
}

console.log('test-refresh-session-client: PASS')
