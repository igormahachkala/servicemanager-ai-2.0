import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const swSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/sw.js'),
  'utf8',
)

describe('iOS installed-PWA cold start', () => {
  it('serves the cached /m shell without waiting for a hanging network request', async () => {
    const handlers = new Map<string, (event: any) => void>()
    const entries = new Map<string, Response>()
    const normalize = (value: string | { url?: string }) => {
      const raw = typeof value === 'string' ? value : value.url || ''
      return new URL(raw, 'https://stage.sma-assistants.ru').href
    }
    const cache = {
      add: async (url: string) => {
        entries.set(normalize(url), new Response('<div id="root"></div>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }))
      },
      put: async (request: string | { url?: string }, response: Response) => {
        entries.set(normalize(request), response)
      },
    }
    const caches = {
      open: async () => cache,
      match: async (request: string | { url?: string }) => entries.get(normalize(request)),
      keys: async () => ['sma-app-shell-v2'],
      delete: async () => true,
    }
    const self = {
      location: { origin: 'https://stage.sma-assistants.ru', href: 'https://stage.sma-assistants.ru/sw.js' },
      registration: { showNotification() {}, pushManager: {} },
      clients: { claim() {}, matchAll: async () => [] },
      skipWaiting() {},
      addEventListener(type: string, handler: (event: any) => void) { handlers.set(type, handler) },
    }
    const context = vm.createContext({
      console,
      URL,
      Response,
      setTimeout,
      clearTimeout,
      self,
      caches,
      fetch: async () => new Response('<div id="root"></div>', { status: 200 }),
    })
    vm.runInContext(swSource, context, { filename: 'sw.js' })

    let installWork = Promise.resolve()
    handlers.get('install')?.({ waitUntil(value: Promise<void>) { installWork = value } })
    await installWork

    context.fetch = () => new Promise<Response>(() => {})
    let responsePromise!: Promise<Response>
    handlers.get('fetch')?.({
      request: { method: 'GET', mode: 'navigate', url: 'https://stage.sma-assistants.ru/m' },
      waitUntil() {},
      respondWith(value: Promise<Response>) { responsePromise = value },
    })

    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('cold start waited for network')), 100)),
    ])
    expect(await response.text()).toContain('id="root"')
  })
})
