import { UnauthorizedException } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long'
  })

  it('revalidates the user and returns current database claims', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'current@example.test',
          companyId: 'company-1',
          role: UserRole.TECHNICIAN,
        }),
      },
    } as any
    const strategy = new JwtStrategy(prisma)

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'stale@example.test',
        companyId: 'company-1',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      sub: 'user-1',
      email: 'current@example.test',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
    })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        companyId: 'company-1',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, email: true, companyId: true, role: true },
    })
  })

  it('rejects a token after the user is disabled or deleted', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } } as any
    const strategy = new JwtStrategy(prisma)

    await expect(
      strategy.validate({ sub: 'user-1', companyId: 'company-1', role: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
