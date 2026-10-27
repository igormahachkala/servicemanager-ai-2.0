import { TicketStatus } from '@prisma/client'

export function lowerEmail(email: string) {
  return email.trim().toLowerCase()
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export function unique<T>(items: readonly T[]) {
  return Array.from(new Set(items))
}

export function hasTicketStatus(statuses: readonly TicketStatus[], status: TicketStatus) {
  return statuses.includes(status)
}

export function assertUnique(label: string, items: readonly string[]) {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item)) {
      throw new Error(`[seed-stage-canonical] duplicate ${label}: ${item}`)
    }
    seen.add(item)
  }
}
