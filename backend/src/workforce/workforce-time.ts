export function parseShiftCloseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec((value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function localParts(date: Date, timezone: string) {
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  }

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function isWorkShiftAutoCloseDue(params: {
  now: Date
  openedAt: Date
  timezone?: string | null
  closeTime: string
}): boolean {
  const close = parseShiftCloseTime(params.closeTime)
  if (!close) return false

  const timezone = (params.timezone || 'UTC').trim() || 'UTC'
  const now = localParts(params.now, timezone)
  const opened = localParts(params.openedAt, timezone)

  if (opened.dateKey < now.dateKey) return true
  if (opened.dateKey > now.dateKey) return false
  return now.minutesOfDay >= close.hours * 60 + close.minutes
}

export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60_000))
}
