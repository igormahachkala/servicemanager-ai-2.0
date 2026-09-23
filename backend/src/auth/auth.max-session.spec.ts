import { UnauthorizedException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'
import { createHmac } from 'node:crypto'

import { AuthService } from './auth.service'

const BOT_TOKEN = 'test-bot-token-054'

function buildInitData(maxUserId: number, authDateSeconds = Math.floor(Date.now() / 1000)): string {
  const params: Record<string, string> = {
    auth_date: String(authDateSeconds),
    query_id: `q-${maxUserId}`,
    user: JSON.stringify({ id: maxUserId, first_name: 'Ada' }),
  }
  const launchParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secretKey).update(launchParams).digest('hex')
  return [
    ...Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`),
    `hash=${hash}`,
  ].join('&')
}

function denyReason(err: unknown): string | undefined {
  if (!(err instanceof UnauthorizedException)) return undefined
  const response = err.getResponse() as { reason?: string }
  return response?.reason
}

describe('AuthService.loginWithMaxInitData', () => {
  const originalToken = process.env.MAX_BOT_API_TOKEN
  let prisma: { user: { findUnique: jest.Mock } }
  let jwt: { sign: jest.Mock }
  let maxIdentity: { resolveByMaxUserId: jest.Mock }
  let maxBindings: { touchBindingAfterSilentLogin: jest.Mock }
  let service: AuthService

  beforeEach(() => {
    process.env.MAX_BOT_API_TOKEN = BOT_TOKEN
    prisma = { user: { findUnique: jest.fn() } }
    jwt = { sign: jest.fn().mockReturnValue('jwt-from-max') }
    maxIdentity = { resolveByMaxUserId: jest.fn() }
    maxBindings = { touchBindingAfterSilentLogin: jest.fn().mockResolvedValue(undefined) }
    service = new AuthService(prisma as any, jwt as any, maxIdentity as any, maxBindings as any)
  })

  afterAll(() => {
    if (originalToken === undefined) delete process.env.MAX_BOT_API_TOKEN
    else process.env.MAX_BOT_API_TOKEN = originalToken
  })

  it('issues the same login payload when the MAX user is ACTIVE-bound', async () => {
    maxIdentity.resolveByMaxUserId.mockResolvedValue({
      resolved: true,
      userId: 'user-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
      maxUserId: '4242',
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'tech@example.com',
      firstName: 'Ada',
      lastName: 'L',
      avatarUrl: null,
      role: UserRole.TECHNICIAN,
      companyId: 'company-1',
      isActive: true,
      company: { name: 'Acme', type: CompanyType.CLIENT },
    })

    const result = await service.loginWithMaxInitData(buildInitData(4242))

    expect(result.access_token).toBe('jwt-from-max')
    expect(result.user.email).toBe('tech@example.com')
    expect(maxBindings.touchBindingAfterSilentLogin).toHaveBeenCalledWith('user-1')
  })

  it('does not touch binding when the MAX user is not bound', async () => {
    maxIdentity.resolveByMaxUserId.mockResolvedValue({ resolved: false, reason: 'not_bound' })

    try {
      await service.loginWithMaxInitData(buildInitData(4242))
      throw new Error('expected deny')
    } catch (err) {
      expect(denyReason(err)).toBe('not_bound')
    }
    expect(maxBindings.touchBindingAfterSilentLogin).not.toHaveBeenCalled()
  })

  it('allows a second silent login with the same initData', async () => {
    maxIdentity.resolveByMaxUserId.mockResolvedValue({
      resolved: true,
      userId: 'user-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
      maxUserId: '4242',
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'tech@example.com',
      firstName: 'Ada',
      lastName: 'L',
      avatarUrl: null,
      role: UserRole.TECHNICIAN,
      companyId: 'company-1',
      isActive: true,
      company: { name: 'Acme', type: CompanyType.CLIENT },
    })

    const initData = buildInitData(4242)
    await service.loginWithMaxInitData(initData)
    const second = await service.loginWithMaxInitData(initData)

    expect(second.access_token).toBe('jwt-from-max')
    expect(maxBindings.touchBindingAfterSilentLogin).toHaveBeenCalledTimes(2)
  })

  it('rejects a broken signature without resolving identity', async () => {
    await expect(service.loginWithMaxInitData('not-init-data')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(maxIdentity.resolveByMaxUserId).not.toHaveBeenCalled()
    expect(maxBindings.touchBindingAfterSilentLogin).not.toHaveBeenCalled()
  })

  it('does not touch binding when the bound user is inactive', async () => {
    maxIdentity.resolveByMaxUserId.mockResolvedValue({ resolved: false, reason: 'user_inactive' })

    try {
      await service.loginWithMaxInitData(buildInitData(4242))
      throw new Error('expected deny')
    } catch (err) {
      expect(denyReason(err)).toBe('user_inactive')
    }
    expect(maxBindings.touchBindingAfterSilentLogin).not.toHaveBeenCalled()
  })
})
