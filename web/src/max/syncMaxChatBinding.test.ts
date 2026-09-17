import { afterEach, describe, expect, it, vi } from 'vitest'

const getToken = vi.fn()
const isImpersonating = vi.fn()
const getMaxBinding = vi.fn()
const createMaxBinding = vi.fn()
const getApiDenyReason = vi.fn()

vi.mock('../lib/api', () => ({
  getToken: () => getToken(),
  isImpersonating: () => isImpersonating(),
  getMaxBinding: (...args: unknown[]) => getMaxBinding(...args),
  createMaxBinding: (...args: unknown[]) => createMaxBinding(...args),
  getApiDenyReason: (...args: unknown[]) => getApiDenyReason(...args),
}))

vi.mock('./maxBridge', () => ({
  loadMaxBridgeScript: vi.fn().mockResolvedValue(undefined),
  getMaxEnvironmentContext: vi.fn(() => ({ initData: 'signed-init', detected: true })),
  getWebApp: vi.fn(() => ({ initData: 'signed-init' })),
}))

import { syncMaxChatBinding } from './syncMaxChatBinding'

describe('syncMaxChatBinding', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('skips without a session', async () => {
    getToken.mockReturnValue(null)
    isImpersonating.mockReturnValue(false)
    expect(await syncMaxChatBinding('signed-init')).toBe('skipped')
    expect(createMaxBinding).not.toHaveBeenCalled()
  })

  it('creates a binding when GET says there is none', async () => {
    getToken.mockReturnValue('jwt')
    isImpersonating.mockReturnValue(false)
    getMaxBinding.mockResolvedValue({ binding: null })
    createMaxBinding.mockResolvedValue({ created: true, binding: { status: 'ACTIVE' } })
    expect(await syncMaxChatBinding('signed-init')).toBe('bound')
    expect(createMaxBinding).toHaveBeenCalledWith('signed-init')
  })

  it('still POSTs when GET fails', async () => {
    getToken.mockReturnValue('jwt')
    isImpersonating.mockReturnValue(false)
    getMaxBinding.mockRejectedValue(new Error('offline'))
    createMaxBinding.mockResolvedValue({ created: true, binding: { status: 'ACTIVE' } })
    expect(await syncMaxChatBinding('signed-init')).toBe('bound')
    expect(createMaxBinding).toHaveBeenCalledWith('signed-init')
  })

  it('does not POST when a binding already exists', async () => {
    getToken.mockReturnValue('jwt')
    isImpersonating.mockReturnValue(false)
    getMaxBinding.mockResolvedValue({ binding: { status: 'ACTIVE' } })
    expect(await syncMaxChatBinding('signed-init')).toBe('bound')
    expect(createMaxBinding).not.toHaveBeenCalled()
  })

  it('skips ordinary browser login without MAX initData', async () => {
    getToken.mockReturnValue('jwt')
    isImpersonating.mockReturnValue(false)
    const { getMaxEnvironmentContext, getWebApp, loadMaxBridgeScript } = await import('./maxBridge')
    vi.mocked(getMaxEnvironmentContext).mockReturnValue({ initData: '', detected: false })
    vi.mocked(getWebApp).mockReturnValue(null)
    expect(await syncMaxChatBinding()).toBe('skipped')
    expect(loadMaxBridgeScript).not.toHaveBeenCalled()
    expect(createMaxBinding).not.toHaveBeenCalled()
  })
})
