export function parseShiftCloseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec((value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/**
 * The timezone actually used for a company, with the pre-existing fallback preserved:
 * an unset or unknown zone is treated as UTC rather than throwing. Extracted from
 * localParts by SMA-SHIFT-AUTOCLOSE-CORRECTNESS-106A so the auto-close boundary and the
 * due-check agree on the same zone by construction instead of by coincidence.
 */
function safeTimeZone(timezone?: string | null): string {
  const candidate = (timezone || '').trim() || 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate })
    return candidate
  } catch {
    return 'UTC'
  }
}

function localParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** Offset of `timeZone` from UTC at a given instant, in milliseconds east of UTC. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]))
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
  return asIfUtc - instant.getTime()
}

/**
 * The UTC instant at which a given local wall-clock time occurs in `timeZone`.
 *
 * Two passes: the offset depends on the instant, and the instant is what we are solving for.
 * The first pass guesses using the offset at the naive-UTC reading, the second re-measures at
 * that guess. This is what makes the boundary correct across a DST transition, where a single
 * pass can land an hour out.
 */
function utcInstantForLocalTime(
  dateKey: string,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const naive = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone)
  const secondPass = naive - zoneOffsetMs(new Date(firstPass), timeZone)
  return new Date(secondPass)
}

/** Calendar-day arithmetic on a `YYYY-MM-DD` key. Pure, zone-independent. */
function addLocalDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const d = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

/**
 * SMA-SHIFT-AUTOCLOSE-CORRECTNESS-106A.
 *
 * The instant an automatically closed shift *should* have ended: the configured
 * `shiftAutoCloseTime` in the company's timezone, as it applies to this particular shift.
 *
 * Before this task the sweeper stamped `closedAt = now` — the moment the 60-second interval
 * happened to reach the row. Production shows what that costs: 52 auto-closed shifts averaging
 * 18.53 h against 8.23 h for manually closed ones, because the sweeper's "now" for a shift that
 * survived past local midnight is midnight-plus-latency, not the configured boundary.
 *
 * The boundary is the FIRST occurrence of `closeTime` strictly after `openedAt`, in local time.
 * For the ordinary same-day case that is today's close time. For a shift caught by the
 * previous-day rule it is the close time of the day the shift was opened — a fact about the
 * shift, not about when the sweeper ran, so two sweepers running a minute apart agree.
 *
 * Returns null when no boundary can be justified from existing configuration, and the caller
 * then keeps today's behaviour (`now`) rather than inventing one:
 *
 *   - `closeTime` unparseable — nothing configured to honour;
 *   - the boundary lies in the future. This happens when a shift was opened at or after the
 *     close time (say 20:00 with a 19:00 boundary): its own next boundary is tomorrow 19:00,
 *     but the previous-day rule already fired at local midnight. Choosing midnight instead
 *     would be a new business rule about night shifts, which 106A is explicitly not allowed to
 *     invent, so this case is left exactly as it behaves today and reported.
 *
 * Never returns an instant before `openedAt`, so a corrected shift can never have negative
 * duration.
 */
export function resolveWorkShiftAutoCloseAt(params: {
  now: Date
  openedAt: Date
  timezone?: string | null
  closeTime: string
}): Date | null {
  const close = parseShiftCloseTime(params.closeTime)
  if (!close) return null

  const timeZone = safeTimeZone(params.timezone)
  const opened = localParts(params.openedAt, timeZone)
  const closeMinutesOfDay = close.hours * 60 + close.minutes

  // ">=" and not ">": a shift opened exactly at the close time belongs to the next boundary,
  // otherwise it would be closed at its own start instant with zero duration.
  const boundaryDateKey =
    opened.minutesOfDay >= closeMinutesOfDay ? addLocalDays(opened.dateKey, 1) : opened.dateKey

  const boundary = utcInstantForLocalTime(boundaryDateKey, close.hours, close.minutes, timeZone)

  if (boundary.getTime() > params.now.getTime()) return null
  if (boundary.getTime() <= params.openedAt.getTime()) return null

  return boundary
}

export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60_000))
}
