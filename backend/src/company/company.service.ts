import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, PublicRequestType, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

import { PrismaService } from '../prisma/prisma.service'
import { UsersPolicy } from '../policy/users.policy'
import { isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { UpdateCompanyDto } from './dto/update-company.dto'
import { CreateCompanyDto } from './dto/create-company.dto'
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto'

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private serviceContractsService: ServiceContractsService,
  ) {}

  async get(actorCompanyId: string, actorRole: UserRole, requestedCompanyId?: string, linkedClientCompanyId?: string) {
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId, linkedClientCompanyId)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companySelect(),
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    return company
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.brandName !== undefined ? { brandName: dto.brandName?.trim() || null } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId?.trim() || null } : {}),
        ...(dto.registrationNumber !== undefined ? { registrationNumber: dto.registrationNumber?.trim() || null } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl?.trim() || null } : {}),
        ...(dto.signatureLineName !== undefined ? { signatureLineName: dto.signatureLineName?.trim() || null } : {}),
        ...(dto.signatureLineTitle !== undefined ? { signatureLineTitle: dto.signatureLineTitle?.trim() || null } : {}),
        ...(dto.autoAssignEnabled !== undefined ? { autoAssignEnabled: dto.autoAssignEnabled } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.allowTechnicianClaim !== undefined ? { allowTechnicianClaim: dto.allowTechnicianClaim } : {}),
        ...(dto.slaStrictMode !== undefined ? { slaStrictMode: dto.slaStrictMode } : {}),
        ...(dto.publicRequestEnabled !== undefined ? { publicRequestEnabled: dto.publicRequestEnabled } : {}),
        ...(dto.publicRequestIntro !== undefined ? { publicRequestIntro: dto.publicRequestIntro?.trim() || null } : {}),
        ...(dto.publicRequestAllowPhotos !== undefined ? { publicRequestAllowPhotos: dto.publicRequestAllowPhotos } : {}),
        ...(dto.publicRequestMaxPhotos !== undefined ? { publicRequestMaxPhotos: dto.publicRequestMaxPhotos } : {}),
        ...(dto.publicRequestRequirePhone !== undefined ? { publicRequestRequirePhone: dto.publicRequestRequirePhone } : {}),
        ...(dto.publicRequestDefaultType !== undefined ? { publicRequestDefaultType: dto.publicRequestDefaultType ?? null } : {}),
        ...(dto.publicRequestRateLimitEnabled !== undefined ? { publicRequestRateLimitEnabled: dto.publicRequestRateLimitEnabled } : {}),
        ...(dto.publicRequestLocationPresetMode !== undefined
          ? { publicRequestLocationPresetMode: dto.publicRequestLocationPresetMode?.trim() || null }
          : {}),
      },
      select: this.companySelect(),
    })
  }

  async setAutoAssign(companyId: string, enabled: boolean) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { autoAssignEnabled: enabled },
      select: this.companySelect(),
    })
  }

  async regeneratePublicRequestToken(companyId: string) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { publicRequestToken: this.newPublicRequestToken() },
      select: this.companySelect(),
    })
  }

  async regeneratePlatformPublicRequestToken(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { publicRequestToken: this.newPublicRequestToken() },
      select: this.platformCompanySelect(),
    })

    return this.toPlatformCompany(company)
  }

  async listAll() {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      select: this.platformCompanySelect(),
    })

    return companies.map((company) => this.toPlatformCompany(company))
  }

  async createPlatformCompany(dto: CreateCompanyDto) {
    const name = dto.name.trim()
    const timezone = dto.timezone?.trim() || 'UTC'

    if (!name) {
      throw new BadRequestException('Company name is required')
    }

    const company = await this.prisma.company.create({
      data: {
        name,
        brandName: name,
        legalName: name,
        email: null,
        phone: null,
        address: null,
        taxId: null,
        registrationNumber: null,
        logoUrl: null,
        signatureLineName: null,
        signatureLineTitle: null,
        type: dto.type ?? CompanyType.CLIENT,
        timezone,
        publicRequestEnabled: true,
        publicRequestToken: this.newPublicRequestToken(),
        publicRequestIntro:
          'Describe the issue, add a photo if needed, and leave a phone number. We will send the request directly into the company service queue.',
        publicRequestAllowPhotos: true,
        publicRequestMaxPhotos: 3,
        publicRequestRequirePhone: true,
        publicRequestDefaultType: PublicRequestType.REPAIR,
        publicRequestRateLimitEnabled: true,
        publicRequestLocationPresetMode: 'HIDE_WHEN_VALID',
      },
      select: this.platformCompanySelect(),
    })

    return this.toPlatformCompany(company)
  }

  async createFirstAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const existingAdmins = await this.prisma.user.count({
      where: {
        companyId,
        role: UserRole.ADMIN,
      },
    })

    if (existingAdmins > 0) {
      throw new BadRequestException('Company already has an admin')
    }

    const email = dto.email.trim().toLowerCase()
    const password = dto.password.trim()
    const firstName = dto.firstName.trim()
    const lastName = dto.lastName.trim()

    if (!email) throw new BadRequestException('Email is required')
    if (!password) throw new BadRequestException('Password is required')
    if (!firstName) throw new BadRequestException('First name is required')
    if (!lastName) throw new BadRequestException('Last name is required')

    const emailOwner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailOwner) {
      throw new BadRequestException('Email already registered')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const created = await this.prisma.user.create({
      data: UsersPolicy.createData(companyId, {
        email,
        password: passwordHash,
        role: UserRole.ADMIN,
        firstName,
        lastName,
        avatarUrl: null,
      }),
      select: UsersPolicy.selectPublicUser(),
    })

    return {
      ...created,
      companyName: company.name,
    }
  }

  private async resolveReadableCompanyId(
    actorCompanyId: string,
    actorRole: UserRole,
    requestedCompanyId?: string,
    linkedClientCompanyId?: string,
  ) {
    const observerCompanyId = resolveObserverScopeCompanyId({
      actorCompanyId,
      actorRole,
      requestedCompanyId,
    })

    if (isPlatformObserverScope({ actorCompanyId, actorRole, scopeCompanyId: observerCompanyId })) {
      await this.ensureCompanyExists(observerCompanyId)
      return observerCompanyId
    }

    if (!linkedClientCompanyId || linkedClientCompanyId === actorCompanyId) {
      return actorCompanyId
    }

    const access = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, linkedClientCompanyId)
    if (!access) {
      throw new BadRequestException('Linked client company is not available')
    }

    if (access.role !== 'PRIMARY') {
      throw new BadRequestException('Linked client company summary is available only for PRIMARY provider')
    }

    return linkedClientCompanyId
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }
  }

  private newPublicRequestToken() {
    return randomUUID().replace(/-/g, '')
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      brandName: true,
      legalName: true,
      address: true,
      phone: true,
      email: true,
      taxId: true,
      registrationNumber: true,
      logoUrl: true,
      signatureLineName: true,
      signatureLineTitle: true,
      type: true,
      autoAssignEnabled: true,
      timezone: true,
      allowTechnicianClaim: true,
      slaStrictMode: true,
      createdAt: true,
      updatedAt: true,
      publicRequestEnabled: true,
      publicRequestToken: true,
      publicRequestIntro: true,
      publicRequestAllowPhotos: true,
      publicRequestMaxPhotos: true,
      publicRequestRequirePhone: true,
      publicRequestDefaultType: true,
      publicRequestRateLimitEnabled: true,
      publicRequestLocationPresetMode: true,
      clientContracts: {
        orderBy: { updatedAt: 'desc' as const },
        select: {
          id: true,
          status: true,
          role: true,
          startsAt: true,
          endsAt: true,
          notes: true,
          updatedAt: true,
          providerCompany: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
      providerContracts: {
        orderBy: { updatedAt: 'desc' as const },
        select: {
          id: true,
          status: true,
          role: true,
          startsAt: true,
          endsAt: true,
          notes: true,
          updatedAt: true,
          clientCompany: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    }
  }

  private platformCompanySelect() {
    return {
      ...this.companySelect(),
      users: {
        where: { role: UserRole.ADMIN },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      },
    }
  }

  private toPlatformCompany(company: any) {
    return {
      id: company.id,
      name: company.name,
      brandName: company.brandName,
      legalName: company.legalName,
      address: company.address,
      phone: company.phone,
      email: company.email,
      taxId: company.taxId,
      registrationNumber: company.registrationNumber,
      logoUrl: company.logoUrl,
      signatureLineName: company.signatureLineName,
      signatureLineTitle: company.signatureLineTitle,
      type: company.type,
      autoAssignEnabled: company.autoAssignEnabled,
      timezone: company.timezone,
      allowTechnicianClaim: company.allowTechnicianClaim,
      slaStrictMode: company.slaStrictMode,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      publicRequestEnabled: company.publicRequestEnabled,
      publicRequestToken: company.publicRequestToken,
      publicRequestIntro: company.publicRequestIntro,
      publicRequestAllowPhotos: company.publicRequestAllowPhotos,
      publicRequestMaxPhotos: company.publicRequestMaxPhotos,
      publicRequestRequirePhone: company.publicRequestRequirePhone,
      publicRequestDefaultType: company.publicRequestDefaultType,
      publicRequestRateLimitEnabled: company.publicRequestRateLimitEnabled,
      publicRequestLocationPresetMode: company.publicRequestLocationPresetMode,
      admins: company.users ?? [],
    }
  }
}