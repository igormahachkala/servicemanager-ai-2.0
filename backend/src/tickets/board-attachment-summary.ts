import { TicketAttachmentPurpose } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

export type BoardImageAttachmentSummary = {
  previewUrl: string
  imageCount: number
}

export async function loadBoardImageAttachmentSummaries(
  prisma: PrismaService,
  ticketIds: string[],
): Promise<Map<string, BoardImageAttachmentSummary>> {
  const map = new Map<string, BoardImageAttachmentSummary & { hasRequestPreview: boolean }>()
  if (!ticketIds.length) return new Map()

  const rows = await prisma.ticketAttachment.findMany({
    where: {
      ticketId: { in: ticketIds },
      mimeType: { startsWith: 'image/' },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      ticketId: true,
      url: true,
      purpose: true,
    },
  })

  for (const row of rows) {
    if (!row.ticketId || !row.url) continue
    const existing = map.get(row.ticketId)
    const isRequest = row.purpose === TicketAttachmentPurpose.REQUEST
    if (!existing) {
      map.set(row.ticketId, {
        previewUrl: row.url,
        imageCount: 1,
        hasRequestPreview: isRequest,
      })
      continue
    }
    existing.imageCount += 1
    if (isRequest && !existing.hasRequestPreview) {
      existing.previewUrl = row.url
      existing.hasRequestPreview = true
    }
  }

  return new Map(
    [...map.entries()].map(([ticketId, value]) => [
      ticketId,
      { previewUrl: value.previewUrl, imageCount: value.imageCount },
    ]),
  )
}
