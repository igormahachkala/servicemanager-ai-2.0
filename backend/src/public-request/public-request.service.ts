import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PublicRequestType, TicketUrgency } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TicketsService } from '../tickets/tickets.service'
import { TicketAttachmentsService } from '../tickets/ticket-attachments.service'
import { requestClientIpOrNull } from '../http/client-ip'
import {
  CreatePublicRequestDto,
  PublicQuickRequestChannel,
  PublicQuickRequestType,
} from './dto/create-public-request.dto'
import { PublicRequestSecurityService } from './public-request-security.service'

@Injectable()
export class PublicRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly attachments: TicketAttachmentsService,
    private readonly security: PublicRequestSecurityService,
  ) {}

  async getContext(token: string, presetLocationId?: string) {
    const company = await this.getCompanyByToken(token)
    const presetLocation = presetLocationId
      ? await this.findPresetLocation(company.id, presetLocationId)
      : null

    return {
      companyName: company.name,
      introText:
        company.publicRequestIntro ||
        'Select a location, describe the issue, add a phone number, and we will route the request to the service team.',
      publicRequestEnabled: company.publicRequestEnabled,
      requestTypes: ['repair', 'note'],
      defaultRequestType: (company.publicRequestDefaultType || PublicRequestType.REPAIR).toLowerCase(),
      featureFlags: {
        equipmentSelection: true,
        photoUpload: company.publicRequestAllowPhotos,
      },
      limits: {
        maxPhotos: company.publicRequestAllowPhotos ? company.publicRequestMaxPhotos : 0,
        requirePhone: company.publicRequestRequirePhone,
      },
      presetLocationMode: company.publicRequestLocationPresetMode || 'HIDE_WHEN_VALID',
      presetLocation,
    }
  }

  async getLocations(token: string, q?: string) {
    const company = await this.getCompanyByToken(token)
    const search = q?.trim()

    return this.prisma.location
      .findMany({
        where: {
          clientCompanyId: company.id,
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { externalCode: { contains: search, mode: 'insensitive' } },
                  { platformCode: { contains: search, mode: 'insensitive' } },
                  { city: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          externalCode: true,
          platformCode: true,
          equipment: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
        },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
      })
      .then((rows) => rows.map((row) => this.mapLocation(row)))
  }

  async getLocationEquipment(token: string, locationId: string) {
    const company = await this.getCompanyByToken(token)

    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: company.id,
        isActive: true,
      },
      select: { id: true },
    })

    if (!location) {
      throw new NotFoundException('Location not found')
    }

    return this.prisma.equipment.findMany({
      where: {
        companyId: company.id,
        locationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
  }

  async create(token: string, dto: CreatePublicRequestDto, files: any[] = [], req?: any) {
    const company = await this.getCompanyByToken(token)
    const selectedLocation = await this.prisma.location.findFirst({
      where: {
        id: dto.locationId,
        clientCompanyId: company.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
      },
    })

    if (!selectedLocation) {
      throw new NotFoundException('Location not found')
    }

    this.security.validatePhotos(files, {
      publicRequestAllowPhotos: company.publicRequestAllowPhotos,
      publicRequestMaxPhotos: company.publicRequestMaxPhotos,
    })

    const normalizedDescription = this.security.normalizeDescription(dto.description)
    const normalizedName = this.security.normalizeName(dto.name)
    const normalizedPhone = this.security.normalizePhone(dto.phone, company.publicRequestRequirePhone)
    const normalizedIp = this.security.normalizeIp(requestClientIpOrNull(req))

    await this.security.assertSubmitAllowed({
      companyId: company.id,
      token,
      ip: normalizedIp,
      phone: normalizedPhone,
      locationId: selectedLocation.id,
      enabled: company.publicRequestRateLimitEnabled,
    })

    const presetLocation = dto.presetLocationId
      ? await this.findPresetLocation(company.id, dto.presetLocationId)
      : null
    const presetLocationAccepted = !!presetLocation && presetLocation.id === selectedLocation.id
    const channel =
      dto.channel === PublicQuickRequestChannel.QR || presetLocationAccepted
        ? PublicQuickRequestChannel.QR
        : PublicQuickRequestChannel.DIRECT_LINK

    const equipmentId = dto.equipmentId
      ? await this.resolveEquipment(company.id, selectedLocation.id, dto.equipmentId)
      : null
    const categoryId = await this.ensurePublicCategory(company.id, dto.requestType)

    const draftAttachments: Array<{ id: string }> = []
    try {
      for (const file of files) {
        const attachment = await this.attachments.uploadDraftAttachment(company.id, null, file)
        draftAttachments.push(attachment)
      }

      const created = await this.tickets.createPublic(company.id, {
        locationId: selectedLocation.id,
        equipmentId,
        categoryId,
        requestType: dto.requestType,
        description: normalizedDescription,
        requesterName: normalizedName,
        requesterPhone: normalizedPhone,
        attachmentIds: draftAttachments.map((item) => item.id),
        urgency: TicketUrgency.NOT_URGENT,
        channel,
        presetLocationId: presetLocationAccepted ? selectedLocation.id : null,
        publicLinkVersion: (dto.publicLinkVersion || 'v2').trim(),
        ipHash: this.security.hash(normalizedIp),
        phoneNormalized: normalizedPhone,
      })

      await this.security.logSubmit({
        companyId: company.id,
        token,
        ip: normalizedIp,
        phone: normalizedPhone,
        locationId: selectedLocation.id,
        channel,
      })

      return {
        ticketId: created.ticket.id,
        ticketNumber: created.ticket.id.slice(0, 8).toUpperCase(),
        source: 'PUBLIC_QUICK_REQUEST',
        requestType: dto.requestType,
        presetLocation: presetLocationAccepted,
        channel,
      }
    } catch (error) {
      for (const attachment of draftAttachments) {
        await this.attachments.deleteDraftAttachment(company.id, null, attachment.id).catch(() => undefined)
      }
      throw error
    }
  }

  private async getCompanyByToken(token: string) {
    const normalized = String(token || '').trim()
    if (!normalized) {
      throw new NotFoundException('Public request channel not found')
    }

    const company = await this.prisma.company.findFirst({
      where: {
        publicRequestEnabled: true,
        publicRequestToken: normalized,
      },
      select: {
        id: true,
        name: true,
        publicRequestEnabled: true,
        publicRequestToken: true,
        publicRequestIntro: true,
        publicRequestAllowPhotos: true,
        publicRequestMaxPhotos: true,
        publicRequestRequirePhone: true,
        publicRequestDefaultType: true,
        publicRequestRateLimitEnabled: true,
        publicRequestLocationPresetMode: true,
      },
    })

    if (!company) {
      throw new NotFoundException('Public request channel not found')
    }

    return company
  }

  private async findPresetLocation(companyId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        externalCode: true,
        platformCode: true,
        equipment: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    })

    return location ? this.mapLocation(location) : null
  }

  private mapLocation(row: {
    id: string
    name: string
    city: string | null
    address: string | null
    externalCode: string | null
    platformCode: string
    equipment: Array<{ id: string }>
  }) {
    return {
      id: row.id,
      name: row.name,
      city: row.city,
      address: row.address,
      externalCode: row.externalCode,
      platformCode: row.platformCode,
      equipmentCount: row.equipment.length,
    }
  }

  private async resolveEquipment(companyId: string, locationId: string, equipmentId: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        companyId,
        locationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })

    if (!equipment) {
      throw new NotFoundException('Equipment not found')
    }

    return equipment.id
  }

  private async ensurePublicCategory(companyId: string, type: PublicQuickRequestType) {
    const name = type === PublicQuickRequestType.REPAIR ? 'Public Repair' : 'Public Note'
    const instructions =
      type === PublicQuickRequestType.REPAIR
        ? 'Created from public quick request repair intake.'
        : 'Created from public quick request note intake.'

    const existing = await this.prisma.problemCategory.findFirst({
      where: {
        companyId,
        name,
      },
      select: { id: true },
    })

    if (existing) {
      return existing.id
    }

    const created = await this.prisma.problemCategory.create({
      data: {
        companyId,
        name,
        instructions,
        isActive: true,
      },
      select: { id: true },
    })

    return created.id
  }
}
