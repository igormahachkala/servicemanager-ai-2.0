import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes } from 'node:crypto'

import { PrismaService } from '../prisma/prisma.service'
import { isEngineeringAgentOwner } from '../agent-tasks/agent-tasks.access'

import { LoginDto } from './dto/login.dto'
import { accessTokenSignOptions, refreshSessionExpiresAt, type RefreshSessionRequestContext } from './auth-token-policy'

type AuthUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl?: string | null
  phone?: string | null
  role: UserRole
  companyId: string
  isActive: boolean
  companyName: string | null
}

type PublicAuthUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  phone: string | null
  role: UserRole
  companyId: string
  companyName: string | null
  isActive: boolean
  canAccessEngineeringAgent: boolean
}

type AuthPayload = {
  access_token: string
  user: PublicAuthUser
}

type SessionAuthResult = {
  payload: AuthPayload
  refreshToken: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto?: { companyName?: string; email?: string; password?: string }) {
    const allowRegisterInCurrentEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_REGISTER === 'true'
    if (!allowRegisterInCurrentEnv) {
      throw new ForbiddenException('Self-service company registration is disabled. Contact platform administrator.')
    }

    const companyName = (dto?.companyName || '').trim()
    const email = (dto?.email || '').trim().toLowerCase()
    const password = (dto?.password || '').trim()

    if (!companyName || !email || !password) {
      throw new BadRequestException('companyName, email and password are required')
    }

    const existsByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existsByEmail) {
      throw new BadRequestException('User with this email already exists')
    }

    const existsByCompany = await this.prisma.company.findFirst({
      where: { name: companyName },
      select: { id: true },
    })
    if (existsByCompany) {
      throw new BadRequestException('Company with this name already exists')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const company = await this.prisma.company.create({
      data: {
        name: companyName,
        type: CompanyType.CLIENT,
      },
      select: { id: true, name: true },
    })

    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
        company: {
          connect: { id: company.id },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    })

    return this.issueAuthPayload({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: company.name,
    })
  }

  async login(dto: LoginDto, context: RefreshSessionRequestContext = {}): Promise<SessionAuthResult> {
    await this.ensurePlatformAdmin()

    const email = dto.email.toLowerCase().trim()
    const password = dto.password.trim()

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        companyId: true,
        isActive: true,
        company: {
          select: { name: true },
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated')
    }

    const ok = await bcrypt.compare(password, user.password)

    if (!ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.issueSessionAuthPayload({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: user.company?.name ?? null,
    }, context)
  }

  async impersonate(platformUser: { role?: UserRole | string }, targetCompanyId: string) {
    if (platformUser.role !== UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('Only PLATFORM_ADMIN can impersonate')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        companyId: targetCompanyId,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!admin) {
      throw new NotFoundException('No admin in company')
    }

    const access_token = this.jwt.sign({
      sub: admin.id,
      userId: admin.id,
      companyId: admin.companyId,
      role: admin.role,
    }, accessTokenSignOptions())

    return {
      access_token,
      impersonated: true,
      company: {
        id: company.id,
        name: company.name,
      },
    }
  }

  async me(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        role: true,
        companyId: true,
        isActive: true,
        company: {
          select: { name: true },
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated')
    }

    return this.toPublicUser({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      phone: user.phone ?? null,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyName: user.company?.name ?? null,
    })
  }

  async refresh(refreshToken: string, context: RefreshSessionRequestContext = {}): Promise<SessionAuthResult> {
    const normalizedToken = (refreshToken || '').trim()
    if (!normalizedToken) {
      throw new UnauthorizedException('Refresh session is required')
    }

    const tokenHash = this.hashRefreshToken(normalizedToken)
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        userAgent: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phone: true,
            role: true,
            companyId: true,
            isActive: true,
            deletedAt: true,
            company: {
              select: { name: true },
            },
          },
        },
      },
    })

    const now = new Date()
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('Refresh session is invalid')
    }

    if (!session.user.isActive || session.user.deletedAt) {
      await this.revokeRefreshSessionById(session.id, 'user_invalid')
      throw new UnauthorizedException('User is inactive or no longer exists')
    }

    const nextRefreshToken = this.generateRefreshToken()
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hashRefreshToken(nextRefreshToken),
        lastUsedAt: now,
        expiresAt: refreshSessionExpiresAt(now),
        userAgent: context.userAgent || session.userAgent,
      },
    })

    return {
      payload: this.issueAuthPayload({
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        avatarUrl: session.user.avatarUrl ?? null,
        phone: session.user.phone ?? null,
        role: session.user.role,
        companyId: session.user.companyId,
        isActive: session.user.isActive,
        companyName: session.user.company?.name ?? null,
      }),
      refreshToken: nextRefreshToken,
    }
  }

  async logout(refreshToken: string): Promise<{ ok: true; revoked: number }> {
    const normalizedToken = (refreshToken || '').trim()
    if (!normalizedToken) return { ok: true, revoked: 0 }

    const result = await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(normalizedToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout',
      },
    })

    return { ok: true, revoked: result.count }
  }

  // Temporary demo bootstrap: ensures one PLATFORM_ADMIN exists from env.
  // Long-term this should move to an explicit seed/init flow, but it stays here
  // for now to keep closed onboarding operable in demo deployments.
  private async ensurePlatformAdmin() {
    const email = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase()
    const password = (process.env.PLATFORM_ADMIN_PASSWORD || '').trim()
    const firstName = (process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim()
    const lastName = (process.env.PLATFORM_ADMIN_LAST_NAME || 'Admin').trim()
    const companyName = (process.env.PLATFORM_COMPANY_NAME || 'СМА-Тех').trim()
    const timezone = (process.env.PLATFORM_COMPANY_TIMEZONE || 'UTC').trim() || 'UTC'

    if (!email && !password) return
    if (!email || !password) {
      throw new BadRequestException('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must be configured together')
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) return

    const passwordHash = await bcrypt.hash(password, 10)

    const company = await this.prisma.company.findFirst({
      where: { name: companyName },
      select: { id: true },
    })

    const companyId =
      company?.id ??
      (
        await this.prisma.company.create({
          data: {
            name: companyName,
            type: CompanyType.PROVIDER,
            timezone,
            publicRequestEnabled: false,
            publicRequestToken: null,
            publicRequestIntro: null,
          },
          select: { id: true },
        })
      ).id

    await this.prisma.user.create({
      data: {
        company: { connect: { id: companyId } },
        email,
        password: passwordHash,
        firstName: firstName || 'Platform',
        lastName: lastName || 'Admin',
        avatarUrl: null,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
      },
    })
  }

  private async issueSessionAuthPayload(user: AuthUser, context: RefreshSessionRequestContext): Promise<SessionAuthResult> {
    const refreshToken = this.generateRefreshToken()
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: refreshSessionExpiresAt(),
        userAgent: context.userAgent || null,
      },
    })

    return {
      payload: this.issueAuthPayload(user),
      refreshToken,
    }
  }

  private issueAuthPayload(user: AuthUser): AuthPayload {
    const access_token = this.jwt.sign({
      sub: user.id,
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    }, accessTokenSignOptions())

    return {
      access_token,
      user: this.toPublicUser(user),
    }
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url')
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private async revokeRefreshSessionById(id: string, reason: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    })
  }

  private toPublicUser(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      phone: user.phone ?? null,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      isActive: user.isActive,
      canAccessEngineeringAgent: isEngineeringAgentOwner({ role: user.role, email: user.email }),
    }
  }
}
