export function inRange(value: Date | string | undefined, from: Date, to: Date) {
  if (!value) return false;
  const instant = value instanceof Date ? value : new Date(value);
  return instant >= from && instant <= to;
}

export function createdAtTime(value?: Date | string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function safeTimeZone(timezone?: string | null) {
  const candidate = (timezone || '').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function zonedDayRange(now: Date, timezone?: string | null) {
  const timeZone = safeTimeZone(timezone);
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const from = utcInstantForLocal(dateKey, 0, 0, timeZone);
  const to = utcInstantForLocal(dateKey, 23, 59, timeZone);
  to.setSeconds(59, 999);
  return { from, to };
}

export function formatClock(value: Date | string, timezone?: string | null) {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: safeTimeZone(timezone),
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

function utcInstantForLocal(dateKey: string, hours: number, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const first = naive - zoneOffsetMs(new Date(naive), timeZone);
  const second = naive - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - instant.getTime();
}
