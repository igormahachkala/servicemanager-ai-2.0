import { BadRequestException, ConflictException } from '@nestjs/common'
import { TicketStatus } from '@prisma/client'

export const PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE = 'PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS'
export const PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE =
  'Parent close requires childResolutions for every unresolved descendant'

export const PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE =
  'childResolutions contains ticket ids that are not unresolved descendants'

export const PARENT_CLOSE_DUPLICATE_CHILD_RESOLUTION_MESSAGE =
  'childResolutions contains duplicate ticket ids'

export type ChildResolution = 'FIELD_COMPLETE' | 'CANCELED'

export type ChildResolutionDraftItem = {
  ticketId: string
  resolution: ChildResolution
}

export type UnresolvedDescendant = {
  id: string
  ticketNumber: number
  problemText: string
  status: TicketStatus
  categoryName: string | null
}

export type CloseTreeTicketRow = {
  id: string
  parentId: string | null
  ticketNumber: number
  problemText: string
  status: TicketStatus
  problemCategory?: { name: string } | null
}

export type CloseTreeDb = {
  ticket: {
    findMany: (args: any) => Promise<any[]>
  }
}

export type CloseTreeWriter = {
  ticket: {
    update: (args: any) => Promise<unknown>
  }
  ticketStatusHistory: {
    create: (args: any) => Promise<unknown>
  }
}

export type CloseTreeTimeline = {
  recordTx: (
    tx: any,
    params: {
      event: 'STATUS_CHANGED'
      companyId: string
      ticketId: string
      actorUserId?: string | null
      payload?: Record<string, unknown>
    },
  ) => Promise<unknown>
}

export const CLOSE_TREE_TICKET_SELECT = {
  id: true,
  parentId: true,
  ticketNumber: true,
  problemText: true,
  status: true,
  problemCategory: { select: { name: true } },
} as const

export class ParentCloseRequiresChildResolutionsException extends ConflictException {
  constructor(unresolved: UnresolvedDescendant[]) {
    super({
      code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE,
      message: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE,
      unresolved,
    })
  }
}

export function isUnresolvedDescendantStatus(status: TicketStatus): boolean {
  return status !== TicketStatus.CANCELED && status !== TicketStatus.DONE
}

export function toUnresolvedDescendant(row: CloseTreeTicketRow): UnresolvedDescendant {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    problemText: row.problemText,
    status: row.status,
    categoryName: row.problemCategory?.name ?? null,
  }
}

export function filterUnresolvedDescendants(rows: CloseTreeTicketRow[]): UnresolvedDescendant[] {
  return rows.filter((row) => isUnresolvedDescendantStatus(row.status)).map(toUnresolvedDescendant)
}

export async function loadTicketDescendants(
  db: CloseTreeDb,
  params: { rootTicketId: string; companyId: string },
): Promise<CloseTreeTicketRow[]> {
  const collected: CloseTreeTicketRow[] = []
  const seen = new Set<string>([params.rootTicketId])
  let frontier = [params.rootTicketId]

  while (frontier.length > 0) {
    const batch = await db.ticket.findMany({
      where: {
        parentId: { in: frontier },
        companyId: params.companyId,
      },
      select: CLOSE_TREE_TICKET_SELECT,
    })

    const nextFrontier: string[] = []
    for (const raw of batch) {
      if (seen.has(raw.id)) continue
      seen.add(raw.id)
      const row: CloseTreeTicketRow = {
        id: raw.id,
        parentId: raw.parentId ?? null,
        ticketNumber: raw.ticketNumber,
        problemText: raw.problemText,
        status: raw.status,
        problemCategory: raw.problemCategory ?? null,
      }
      collected.push(row)
      nextFrontier.push(row.id)
    }
    frontier = nextFrontier
  }

  return collected
}

export async function loadUnresolvedDescendants(
  db: CloseTreeDb,
  params: { rootTicketId: string; companyId: string },
): Promise<UnresolvedDescendant[]> {
  const descendants = await loadTicketDescendants(db, params)
  return filterUnresolvedDescendants(descendants)
}

export function assertChildResolutionsForParentClose(
  unresolved: UnresolvedDescendant[],
  childResolutions?: ChildResolutionDraftItem[] | null,
): ChildResolutionDraftItem[] | null {
  if (unresolved.length === 0) {
    if (childResolutions && childResolutions.length > 0) {
      throw new BadRequestException(PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE)
    }
    return null
  }

  if (!childResolutions || childResolutions.length === 0) {
    throw new ParentCloseRequiresChildResolutionsException(unresolved)
  }

  const unresolvedIds = new Set(unresolved.map((row) => row.id))
  const seen = new Set<string>()
  let hasExtra = false

  for (const item of childResolutions) {
    if (seen.has(item.ticketId)) {
      throw new BadRequestException(PARENT_CLOSE_DUPLICATE_CHILD_RESOLUTION_MESSAGE)
    }
    seen.add(item.ticketId)
    if (!unresolvedIds.has(item.ticketId)) {
      hasExtra = true
    }
    if (item.resolution !== 'FIELD_COMPLETE' && item.resolution !== 'CANCELED') {
      throw new BadRequestException(PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE)
    }
  }

  if (hasExtra) {
    throw new BadRequestException(PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE)
  }

  if (seen.size !== unresolvedIds.size) {
    throw new ParentCloseRequiresChildResolutionsException(unresolved)
  }

  return childResolutions
}

export async function prepareParentClose(
  db: CloseTreeDb,
  params: {
    rootTicketId: string
    companyId: string
    childResolutions?: ChildResolutionDraftItem[] | null
  },
): Promise<{
  descendants: CloseTreeTicketRow[]
  unresolved: UnresolvedDescendant[]
  draft: ChildResolutionDraftItem[] | null
}> {
  const descendants = await loadTicketDescendants(db, {
    rootTicketId: params.rootTicketId,
    companyId: params.companyId,
  })
  const unresolved = filterUnresolvedDescendants(descendants)
  const draft = assertChildResolutionsForParentClose(unresolved, params.childResolutions)
  return { descendants, unresolved, draft }
}

async function writeChildStatusShift(
  tx: CloseTreeWriter,
  params: {
    timeline: CloseTreeTimeline
    parentCompanyId: string
    actorUserId: string | null
    ticketId: string
    fromStatus: TicketStatus
    toStatus: TicketStatus
  },
) {
  await tx.ticketStatusHistory.create({
    data: {
      ticketId: params.ticketId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      comment: null,
      changedByUserId: params.actorUserId,
    },
  })

  await params.timeline.recordTx(tx, {
    event: 'STATUS_CHANGED',
    companyId: params.parentCompanyId,
    ticketId: params.ticketId,
    actorUserId: params.actorUserId,
    payload: { fromStatus: params.fromStatus, toStatus: params.toStatus },
  })
}

export async function applyChildResolutionsInTx(
  tx: CloseTreeWriter,
  params: {
    timeline: CloseTreeTimeline
    parentCompanyId: string
    actorUserId: string | null
    descendants: CloseTreeTicketRow[]
    draft: ChildResolutionDraftItem[]
  },
): Promise<CloseTreeTicketRow[]> {
  const now = new Date()
  const next = params.descendants.map((row) => ({ ...row }))
  const byId = new Map(next.map((row) => [row.id, row]))

  for (const item of params.draft) {
    const row = byId.get(item.ticketId)
    if (!row) continue
    const toStatus =
      item.resolution === 'CANCELED' ? TicketStatus.CANCELED : TicketStatus.FIELD_COMPLETE
    if (row.status === toStatus) continue

    const fromStatus = row.status
    await tx.ticket.update({
      where: { id: row.id },
      data: {
        status: toStatus,
        statusUpdatedAt: now,
      },
    })
    await writeChildStatusShift(tx, {
      timeline: params.timeline,
      parentCompanyId: params.parentCompanyId,
      actorUserId: params.actorUserId,
      ticketId: row.id,
      fromStatus,
      toStatus,
    })
    row.status = toStatus
  }

  return next
}

export async function stampFieldCompleteDescendantsDoneInTx(
  tx: CloseTreeWriter,
  params: {
    timeline: CloseTreeTimeline
    parentCompanyId: string
    actorUserId: string | null
    descendants: CloseTreeTicketRow[]
  },
): Promise<void> {
  const now = new Date()

  for (const row of params.descendants) {
    if (row.status !== TicketStatus.FIELD_COMPLETE) continue

    await tx.ticket.update({
      where: { id: row.id },
      data: {
        status: TicketStatus.DONE,
        statusUpdatedAt: now,
        closedAt: now,
      },
    })
    await writeChildStatusShift(tx, {
      timeline: params.timeline,
      parentCompanyId: params.parentCompanyId,
      actorUserId: params.actorUserId,
      ticketId: row.id,
      fromStatus: TicketStatus.FIELD_COMPLETE,
      toStatus: TicketStatus.DONE,
    })
    row.status = TicketStatus.DONE
  }
}
