import { PrismaService } from '../prisma/prisma.service'

/**
 * Индикатор 💬 на карточке списка заявок.
 *
 * Непрочитанным считается комментарий чата (TicketComment) другого автора,
 * созданный позже отметки прочтения пользователя. Отметка — lastReadAt из
 * TicketChatRead, а без строки — User.chatReadBaseline: переписка, которая
 * была до выкатки индикатора, не загорается разом у всех.
 *
 * Комментарий без автора (пользователь удалён) — чужой: свой комментарий
 * удалённым быть не может, раз пользователь сейчас смотрит список.
 */
export function hasUnreadChat(input: {
  latestForeignCommentAt: Date | null | undefined
  lastReadAt: Date | null | undefined
  baseline: Date
}): boolean {
  const latest = input.latestForeignCommentAt
  if (!latest) return false
  const lastRead = input.lastReadAt
  const threshold =
    lastRead && lastRead.getTime() > input.baseline.getTime() ? lastRead : input.baseline
  return latest.getTime() > threshold.getTime()
}

/**
 * Три запроса на всю доску, без N+1: отметка пользователя, его строки
 * прочтения по видимым заявкам и время последнего чужого комментария
 * по каждой из них. Комментарии старше отметки в группировку не попадают.
 */
export async function loadUnreadChatTicketIds(
  prisma: PrismaService,
  userId: string,
  ticketIds: string[],
): Promise<Set<string>> {
  if (!userId || !ticketIds.length) return new Set()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatReadBaseline: true },
  })
  if (!user) return new Set()

  const [reads, latest] = await Promise.all([
    prisma.ticketChatRead.findMany({
      where: { userId, ticketId: { in: ticketIds } },
      select: { ticketId: true, lastReadAt: true },
    }),
    prisma.ticketComment.groupBy({
      by: ['ticketId'],
      where: {
        ticketId: { in: ticketIds },
        createdAt: { gt: user.chatReadBaseline },
        // NOT { authorUserId: userId } в SQL отбросил бы и строки с NULL.
        OR: [{ authorUserId: null }, { authorUserId: { not: userId } }],
      },
      _max: { createdAt: true },
    }),
  ])

  const lastReadByTicketId = new Map(reads.map((row) => [row.ticketId, row.lastReadAt]))
  const unread = new Set<string>()
  for (const row of latest) {
    if (
      hasUnreadChat({
        latestForeignCommentAt: row._max.createdAt,
        lastReadAt: lastReadByTicketId.get(row.ticketId),
        baseline: user.chatReadBaseline,
      })
    ) {
      unread.add(row.ticketId)
    }
  }
  return unread
}
