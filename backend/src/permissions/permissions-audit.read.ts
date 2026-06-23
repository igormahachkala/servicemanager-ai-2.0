import { PrismaService } from '../prisma/prisma.service'

type ReadableUser = {
  id: string
  companyId: string
}

export async function readUserPermissionAuditHistory(
  prisma: PrismaService,
  user: ReadableUser,
  input: { take: number; skip: number },
) {
  const where = {
    companyId: user.companyId,
    entityType: 'User',
    entityId: user.id,
    type: 'user.permission_overrides_updated',
  }

  const [events, total, targetUser] = await Promise.all([
    prisma.domainEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: input.take,
      skip: input.skip,
      select: {
        id: true,
        actorUserId: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.domainEvent.count({ where }),
    prisma.user.findFirst({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    }),
  ])

  const actorIds = Array.from(
    new Set(events.map((event) => event.actorUserId).filter((id): id is string => !!id)),
  )

  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      })
    : []

  const actorMap = new Map(actors.map((row) => [row.id, row]))

  const items = events.map((event) => {
    const parsed = parseAuditPayload(event.payload)
    const diff = diffPermissionCodes(parsed.previousPermissionCodes, parsed.grantPermissionCodes)
    const actorRow = event.actorUserId ? actorMap.get(event.actorUserId) : null

    return {
      id: event.id,
      createdAt: event.createdAt,
      reason: parsed.reason,
      addedPermissionCodes: diff.added,
      removedPermissionCodes: diff.removed,
      actor: actorRow
        ? {
            userId: actorRow.id,
            email: actorRow.email,
            firstName: actorRow.firstName,
            lastName: actorRow.lastName,
          }
        : null,
    }
  })

  return {
    userId: user.id,
    targetUser: targetUser
      ? {
          userId: targetUser.id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        }
      : null,
    items,
    meta: {
      total,
      take: input.take,
      skip: input.skip,
      generatedAt: new Date().toISOString(),
    },
  }
}

function parseAuditPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return {
      reason: '',
      grantPermissionCodes: [] as string[],
      previousPermissionCodes: [] as string[],
    }
  }

  const record = payload as Record<string, unknown>
  const grantPermissionCodes = Array.isArray(record.grantPermissionCodes)
    ? record.grantPermissionCodes.map((code) => String(code || '').trim()).filter(Boolean)
    : []
  const previousPermissionCodes = Array.isArray(record.previousPermissionCodes)
    ? record.previousPermissionCodes.map((code) => String(code || '').trim()).filter(Boolean)
    : []

  return {
    reason: typeof record.reason === 'string' ? record.reason.trim() : '',
    grantPermissionCodes,
    previousPermissionCodes,
  }
}

function diffPermissionCodes(previousPermissionCodes: string[], grantPermissionCodes: string[]) {
  const previousSet = new Set(previousPermissionCodes)
  const grantSet = new Set(grantPermissionCodes)

  return {
    added: grantPermissionCodes.filter((code) => !previousSet.has(code)).sort(),
    removed: previousPermissionCodes.filter((code) => !grantSet.has(code)).sort(),
  }
}
