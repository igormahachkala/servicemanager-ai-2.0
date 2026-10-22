import { BadRequestException } from '@nestjs/common';

import { zonedInstant, zonedParts } from '../inspection/inspection-recurrence';

/**
 * SMA-WORK-CALENDAR-V1 — диапазон и часовой пояс календаря.
 *
 * Диапазон полуоткрытый, [from, to): неделя — это семь полных суток, и
 * событие ровно в полночь следующего понедельника в неё не попадает.
 *
 * Граница задаётся либо датой (YYYY-MM-DD) — тогда это полночь этих суток
 * в поясе календаря, либо моментом с явным смещением (…Z, …+03:00).
 * Момент без смещения отклоняется: из него нельзя понять, чья это полночь.
 *
 * Перевод местного времени в момент — тот же, что у повторения обходов
 * (inspection-recurrence): двух правил «полночи по поясу» в проекте не будет.
 */

/** Наибольшая длина диапазона: шесть недель месячной сетки с запасом. */
export const WORK_CALENDAR_MAX_RANGE_DAYS = 62;

const MS_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isValidTimeZone(value: string): boolean {
  if (!value || !value.includes('/')) return value === 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Пояс календаря. Явно переданный неизвестный пояс — ошибка запроса, а не
 * тихий UTC: иначе сутки разъедутся на часы смещения и никто этого не заметит.
 * Не передан — пояс компании актора, а при его отсутствии UTC.
 */
export function resolveCalendarTimeZone(
  requested: string | undefined,
  companyTimeZone: string | null | undefined,
): string {
  const explicit = (requested ?? '').trim();
  if (explicit) {
    if (!isValidTimeZone(explicit)) {
      throw new BadRequestException('Invalid timezone: expected IANA name');
    }
    return explicit;
  }
  const fallback = (companyTimeZone ?? '').trim();
  return fallback && isValidTimeZone(fallback) ? fallback : 'UTC';
}

export function parseRangeBound(
  value: string | undefined,
  timeZone: string,
  name: 'from' | 'to',
): Date {
  const raw = (value ?? '').trim();
  if (!raw) throw new BadRequestException(`${name} is required`);

  const dateOnly = DATE_ONLY.exec(raw);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      throw new BadRequestException(`Invalid ${name}`);
    }
    return zonedInstant(
      { year, month, day, hour: 0, minute: 0, second: 0, ms: 0 },
      timeZone,
    );
  }

  if (INSTANT_WITH_OFFSET.test(raw)) {
    const instant = new Date(raw);
    if (!Number.isNaN(instant.getTime())) return instant;
  }

  throw new BadRequestException(
    `Invalid ${name}: expected YYYY-MM-DD or ISO 8601 with offset`,
  );
}

export function resolveCalendarRange(params: {
  from?: string;
  to?: string;
  timeZone: string;
}): { from: Date; to: Date } {
  const from = parseRangeBound(params.from, params.timeZone, 'from');
  const to = parseRangeBound(params.to, params.timeZone, 'to');
  if (to.getTime() <= from.getTime()) {
    throw new BadRequestException('to must be after from');
  }
  if (to.getTime() - from.getTime() > WORK_CALENDAR_MAX_RANGE_DAYS * MS_DAY) {
    throw new BadRequestException(
      `Range is limited to ${WORK_CALENDAR_MAX_RANGE_DAYS} days`,
    );
  }
  return { from, to };
}

/** Местные сутки момента в поясе календаря, YYYY-MM-DD. */
export function localDateOf(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
