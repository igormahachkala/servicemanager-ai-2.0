import { BadRequestException, NotFoundException } from '@nestjs/common'

export const PARENT_TICKET_CREATE_SELECT = {
  id: true,
  companyId: true,
  locationId: true,
  ticketNumber: true,
  requesterName: true,
  requesterPhone: true,
  address: true,
  pointName: true,
} as const

export type ParentTicketForCreate = {
  id: string
  companyId: string
  locationId: string
  ticketNumber: number
  requesterName: string | null
  requesterPhone: string | null
  address: string | null
  pointName: string | null
}

export type ParentTicketCreateClient = {
  ticket: {
    findFirst: (args: {
      where: { id: string }
      select: typeof PARENT_TICKET_CREATE_SELECT
    }) => Promise<ParentTicketForCreate | null>
  }
}

export async function loadParentTicketForCreate(
  prisma: ParentTicketCreateClient,
  parentId: string,
): Promise<ParentTicketForCreate> {
  const id = (parentId ?? '').trim()
  if (!id) {
    throw new NotFoundException('Parent ticket not found')
  }

  const parent = await prisma.ticket.findFirst({
    where: { id },
    select: PARENT_TICKET_CREATE_SELECT,
  })
  if (!parent) {
    throw new NotFoundException('Parent ticket not found')
  }
  return parent
}

export function resolveParentCreateLocationId(params: {
  parent: ParentTicketForCreate
  requestedLocationId?: string | null
}): string {
  const requested = (params.requestedLocationId ?? '').trim()
  if (requested && requested !== params.parent.locationId) {
    throw new BadRequestException('locationId must match parent ticket location')
  }
  return params.parent.locationId
}

export function assertParentTicketOwnerCompany(params: {
  parent: ParentTicketForCreate
  targetCompanyId: string
}) {
  if (params.parent.companyId !== params.targetCompanyId) {
    throw new NotFoundException('Parent ticket not found')
  }
}
