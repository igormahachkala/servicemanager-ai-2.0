import { UnauthorizedException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { createHash } from 'node:crypto'

import { AuthService } from './auth.service'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'tech@example.test',
    password: 'hash',
    firstName: 'Тест',
    lastName: 'Техник',
    avatarUrl: null,
    phone: null,
    role: UserRole.TECHNICIAN,
    companyId: 'company-1',
    isActive: true,
    deletedAt: null,
    company: { name: 'Тестовая компания' },
    ...overrides,
  }
}

function makeService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any
  const jwt = {
    sign: jest.fn(() => 'access-token'),
  } as any

  return { service: new AuthService(prisma, jwt), prisma, jwt }
}

describe('AuthService refresh sessions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.PLATFORM_ADMIN_EMAIL
    delete process.env.PLATFORM_ADMIN_PASSWORD
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long'
    process.env.AUTH_ACCESS_TOKEN_TTL = '15m'
    process.env.AUTH_REFRESH_SESSION_TTL_MS = String(60 * 60 * 1000)
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('login creates a hashed refresh session and returns only access payload plus raw cookie token to controller', async () => {
    const { service, prisma, jwt } = makeService()
    prisma.user.findUnique.mockResolvedValue(user({ password: await bcrypt.hash('pw', 4) }))
    prisma.refreshSession.create.mockResolvedValue({ id: 'session-1' })

    const result = await service.login({ email: 'TECH@example.test', password: 'pw' }, { userAgent: 'iPhone PWA' })

    expect(result.payload.access_token).toBe('access-token')
    expect(result.payload.user.email).toBe('tech@example.test')
    expect(result.refreshToken).toBeTruthy()
    expect(result.payload).not.toHaveProperty('refreshToken')
    expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1)
    const data = prisma.refreshSession.create.mock.calls[0][0].data
    expect(data.userId).toBe('user-1')
    expect(data.userAgent).toBe('iPhone PWA')
    expect(data.tokenHash).toHaveLength(64)
    expect(data.tokenHash).not.toBe(result.refreshToken)
    expect(data.tokenHash).toBe(hashToken(result.refreshToken))
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 'user-1' }), { expiresIn: '15m' })
  })

  it('refresh rotates token hash and issues a new access token', async () => {
    const { service, prisma } = makeService()
    const oldToken = 'old-refresh-token'
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      userAgent: 'old UA',
      user: user(),
    })
    prisma.refreshSession.update.mockResolvedValue({ id: 'session-1' })

    const result = await service.refresh(oldToken, { userAgent: 'new UA' })

    expect(prisma.refreshSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashToken(oldToken) },
    }))
    expect(result.payload.access_token).toBe('access-token')
    expect(result.refreshToken).toBeTruthy()
    expect(result.refreshToken).not.toBe(oldToken)
    const updateData = prisma.refreshSession.update.mock.calls[0][0].data
    expect(updateData.tokenHash).toHaveLength(64)
    expect(updateData.tokenHash).toBe(hashToken(result.refreshToken))
    expect(updateData.tokenHash).not.toBe(hashToken(oldToken))
    expect(updateData.lastUsedAt).toBeInstanceOf(Date)
    expect(updateData.userAgent).toBe('new UA')
  })

  it('rejects old refresh token after rotation when its hash no longer exists', async () => {
    const { service, prisma } = makeService()
    prisma.refreshSession.findUnique.mockResolvedValue(null)

    await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects revoked and expired refresh sessions', async () => {
    const { service, prisma } = makeService()
    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      id: 'revoked',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: user(),
    })
    await expect(service.refresh('revoked-token')).rejects.toBeInstanceOf(UnauthorizedException)

    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      id: 'expired',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      user: user(),
    })
    await expect(service.refresh('expired-token')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('revokes refresh session and rejects when user is inactive or deleted', async () => {
    const { service, prisma } = makeService()
    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: user({ isActive: false }),
    })
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 })

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null },
      data: expect.objectContaining({ revokedReason: 'user_invalid' }),
    })

    prisma.refreshSession.findUnique.mockResolvedValueOnce({
      id: 'session-2',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: user({ deletedAt: new Date() }),
    })

    await expect(service.refresh('deleted-user-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshSession.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'session-2', revokedAt: null },
      data: expect.objectContaining({ revokedReason: 'user_invalid' }),
    })
  })

  it('logout revokes only the current refresh token hash', async () => {
    const { service, prisma } = makeService()
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 })

    await expect(service.logout('refresh-token')).resolves.toEqual({ ok: true, revoked: 1 })
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken('refresh-token'),
        revokedAt: null,
      },
      data: expect.objectContaining({ revokedReason: 'logout' }),
    })
  })
})
