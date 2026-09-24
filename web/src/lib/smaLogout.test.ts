import { describe, expect, it, vi } from 'vitest'

import { runSmaLogout } from './smaLogout'

describe('runSmaLogout', () => {
  it('revokes with Mini App initData before dropping the token', async () => {
    const revokeMaxBinding = vi.fn()
    const clearToken = vi.fn()
    const order: string[] = []
    revokeMaxBinding.mockImplementation(async () => {
      order.push('revoke')
    })
    clearToken.mockImplementation(() => {
      order.push('clear')
    })

    await runSmaLogout({
      getToken: () => 'jwt',
      isImpersonating: () => false,
      revokeMaxBinding,
      getMaxInitData: () => 'signed-init',
      clearToken,
    })

    expect(revokeMaxBinding).toHaveBeenCalledWith('signed-init')
    expect(clearToken).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['revoke', 'clear'])
  })

  it('does not unbind on browser or desktop logout', async () => {
    const revokeMaxBinding = vi.fn()
    const clearToken = vi.fn()

    await runSmaLogout({
      getToken: () => 'jwt',
      isImpersonating: () => false,
      revokeMaxBinding,
      getMaxInitData: () => '',
      clearToken,
    })

    expect(revokeMaxBinding).not.toHaveBeenCalled()
    expect(clearToken).toHaveBeenCalledTimes(1)
  })

  it('skips revoke when impersonating', async () => {
    const revokeMaxBinding = vi.fn()
    const clearToken = vi.fn()

    await runSmaLogout({
      getToken: () => 'jwt',
      isImpersonating: () => true,
      revokeMaxBinding,
      getMaxInitData: () => 'signed-init',
      clearToken,
    })

    expect(revokeMaxBinding).not.toHaveBeenCalled()
    expect(clearToken).toHaveBeenCalledTimes(1)
  })

  it('clears the token even if revoke fails', async () => {
    const clearToken = vi.fn()

    await runSmaLogout({
      getToken: () => 'jwt',
      isImpersonating: () => false,
      revokeMaxBinding: async () => {
        throw new Error('offline')
      },
      getMaxInitData: () => 'signed-init',
      clearToken,
    })

    expect(clearToken).toHaveBeenCalledTimes(1)
  })
})
