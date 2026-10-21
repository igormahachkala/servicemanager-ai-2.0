import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getMaxEnvironmentContext,
  isMaxEnvironment,
  loadMaxBridgeScript,
} from './maxBridge'
import {
  classifyMaxAuthFailure,
  hasSmaSessionToken,
  isMaxContextAvailable,
  resolveMaxReturnTo,
} from './maxBootstrap'

class FakeScript {
  attributes = new Map<string, string>()
  listeners = new Map<string, Array<() => void>>()
  src = ''
  async = false
  parentNode: { appendChild: (script: FakeScript) => void; removeChild: (script: FakeScript) => void } | null = null
  readyState = ''

  setAttribute(key: string, value: string) {
    this.attributes.set(key, String(value))
  }

  getAttribute(key: string) {
    return this.attributes.get(key) ?? null
  }

  addEventListener(type: string, handler: () => void) {
    const current = this.listeners.get(type) || []
    current.push(handler)
    this.listeners.set(type, current)
  }

  removeEventListener(type: string, handler: () => void) {
    const current = this.listeners.get(type) || []
    this.listeners.set(type, current.filter((item) => item !== handler))
  }

  dispatch(type: string) {
    for (const handler of this.listeners.get(type) || []) handler()
  }
}

class FakeDocument {
  scripts: FakeScript[] = []
  onAppend: ((script: FakeScript) => void) | null

  constructor(onAppend: ((script: FakeScript) => void) | null = null) {
    this.onAppend = onAppend
    this.head = {
      appendChild: (script: FakeScript) => {
        script.parentNode = this.head
        this.scripts.push(script)
        this.onAppend?.(script)
      },
      removeChild: (script: FakeScript) => {
        this.scripts = this.scripts.filter((item) => item !== script)
        script.parentNode = null
      },
    }
  }

  head: {
    appendChild: (script: FakeScript) => void
    removeChild: (script: FakeScript) => void
  }

  querySelector(selector: string) {
    if (selector !== 'script[data-max-bridge]') return null
    return this.scripts.find((script) => script.getAttribute('data-max-bridge') !== null) || null
  }

  createElement(tag: string) {
    expect(tag).toBe('script')
    return new FakeScript()
  }
}

function setDom(windowValue: object, documentValue: FakeDocument) {
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: windowValue })
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: documentValue })
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: undefined })
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: undefined })
})

describe('MAX bootstrap', () => {
  it('resolves immediately when WebApp is already present', async () => {
    setDom({ WebApp: { initData: 'signed' } }, new FakeDocument())
    await expect(loadMaxBridgeScript({ timeoutMs: 10 })).resolves.toBeUndefined()
  })

  it('resolves after the script load event', async () => {
    vi.useFakeTimers()
    const windowValue: { WebApp?: { initData: string } } = {}
    const documentValue = new FakeDocument((script) => {
      setTimeout(() => {
        windowValue.WebApp = { initData: 'signed' }
        script.readyState = 'complete'
        script.dispatch('load')
      }, 5)
    })
    setDom(windowValue, documentValue)
    const pending = loadMaxBridgeScript({ timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(5)
    await pending
    expect(windowValue.WebApp?.initData).toBe('signed')
  })

  it('rejects on script error', async () => {
    vi.useFakeTimers()
    const documentValue = new FakeDocument((script) => {
      setTimeout(() => script.dispatch('error'), 5)
    })
    setDom({}, documentValue)
    const pending = loadMaxBridgeScript({ timeoutMs: 50 })
    const assertion = expect(pending).rejects.toThrow(/MAX Bridge/)
    await vi.advanceTimersByTimeAsync(5)
    await assertion
  })

  it('rejects on timeout and removes the script', async () => {
    vi.useFakeTimers()
    const documentValue = new FakeDocument()
    setDom({}, documentValue)
    const pending = loadMaxBridgeScript({ timeoutMs: 5 })
    const assertion = expect(pending).rejects.toThrow(/MAX Bridge/)
    await vi.advanceTimersByTimeAsync(5)
    await assertion
    expect(documentValue.scripts).toHaveLength(0)
  })

  it('does not treat a loaded script without WebApp as MAX', async () => {
    vi.useFakeTimers()
    const documentValue = new FakeDocument((script) => {
      setTimeout(() => {
        script.readyState = 'complete'
        script.dispatch('load')
      }, 5)
    })
    setDom({}, documentValue)
    const pending = loadMaxBridgeScript({ timeoutMs: 50 })
    await vi.advanceTimersByTimeAsync(5)
    await pending
    expect(isMaxEnvironment()).toBe(false)
    expect(isMaxContextAvailable(getMaxEnvironmentContext())).toBe(false)
  })

  it('detects MAX from initData or unsafe fields', () => {
    setDom({ WebApp: { initData: '', initDataUnsafe: {} } }, new FakeDocument())
    expect(isMaxEnvironment()).toBe(false)

    setDom({ WebApp: { initData: '', initDataUnsafe: { user: {} } } }, new FakeDocument())
    expect(isMaxEnvironment()).toBe(true)

    setDom({ WebApp: { initData: '', initDataUnsafe: { chat: {} } } }, new FakeDocument())
    expect(isMaxEnvironment()).toBe(true)

    setDom({ WebApp: { initData: '', initDataUnsafe: { start_param: 'ticket_42' } } }, new FakeDocument())
    expect(isMaxEnvironment()).toBe(true)
  })

  it('resolves returnTo inside /max and rejects an external one', () => {
    expect(
      resolveMaxReturnTo({ pathname: '/max', search: '?startapp=ticket_42', startParam: 'ticket_42' }),
    ).toBe('/max/tickets/42')
    expect(
      resolveMaxReturnTo({ pathname: '/max/tickets/42', search: '?section=comments', hash: '#top' }),
    ).toBe('/max/tickets/42?section=comments#top')
    expect(resolveMaxReturnTo({ pathname: '/login', search: '?returnTo=https%3A%2F%2Fevil.example' })).toBe('/max')
  })

  it('classifies session and auth failures', () => {
    expect(hasSmaSessionToken(null)).toBe(false)
    expect(hasSmaSessionToken('')).toBe(false)
    expect(hasSmaSessionToken('token')).toBe(true)
    expect(classifyMaxAuthFailure({ status: 401 })).toBe('unauthenticated')
    expect(classifyMaxAuthFailure({ status: 403 })).toBe('unauthenticated')
    expect(classifyMaxAuthFailure(new Error('network failed'))).toBe('temporary_error')
    expect(classifyMaxAuthFailure({ name: 'ApiTimeoutError' })).toBe('temporary_error')
  })
})
