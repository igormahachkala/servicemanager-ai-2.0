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
  it('precaches lazy chunks and serves the cached /m shell without waiting for network', async () => {
    const handlers = new Map<string, (event: any) => void>()
    const entries = new Map<string, Response>()
    const deletedCaches: string[] = []
    const manifest = {
      'src/router.tsx': {
        file: 'assets/index-current.js',
        css: ['assets/index-current.css'],
        dynamicImports: ['src/mobile/MobileTicketPage.tsx'],
      },
      'src/mobile/MobileTicketPage.tsx': {
        file: 'assets/MobileTicketPage-current.js',
        css: ['assets/MobileShell-current.css'],
      },
    }
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
      keys: async () => ['sma-app-shell-v2', 'sma-app-shell-v3'],
      delete: async (name: string) => { deletedCaches.push(name); return true },
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
      fetch: async (request: string | { url?: string }) => {
        const url = normalize(request)
        if (url.endsWith('/asset-manifest.json')) {
          return new Response(JSON.stringify(manifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(url.endsWith('.css') ? 'body{}' : '<div id="root"></div>', { status: 200 })
      },
    })
    vm.runInContext(swSource, context, { filename: 'sw.js' })

    let installWork = Promise.resolve()
    handlers.get('install')?.({ waitUntil(value: Promise<void>) { installWork = value } })
    await installWork
    expect(entries.has(normalize('/assets/MobileTicketPage-current.js'))).toBe(true)
    expect(entries.has(normalize('/assets/MobileShell-current.css'))).toBe(true)

    let activateWork = Promise.resolve()
    handlers.get('activate')?.({ waitUntil(value: Promise<void>) { activateWork = value } })
    await activateWork
    expect(deletedCaches).toEqual([])

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

    let assetResponsePromise!: Promise<Response>
    handlers.get('fetch')?.({
      request: {
        method: 'GET',
        mode: 'cors',
        url: 'https://stage.sma-assistants.ru/assets/MobileTicketPage-current.js',
      },
      respondWith(value: Promise<Response>) { assetResponsePromise = value },
    })
    const assetResponse = await Promise.race([
      assetResponsePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('lazy chunk waited for network')), 100)),
    ])
    expect(await assetResponse.text()).toContain('id="root"')
  })
})
