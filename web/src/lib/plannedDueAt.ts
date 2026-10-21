export function dateTimeLocalToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function isoToDateTimeLocalValue(value?: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    parsed.getFullYear(),
    '-',
    pad(parsed.getMonth() + 1),
    '-',
    pad(parsed.getDate()),
    'T',
    pad(parsed.getHours()),
    ':',
    pad(parsed.getMinutes()),
  ].join('')
}

export function formatPlannedDueAt(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Есть ли в поле срока что-то, что пользователь видит и может захотеть убрать.
 * Частично стёртый datetime-local отдаёт value === '', но продолжает показывать
 * оставшиеся части даты; браузер помечает такое состояние validity.badInput.
 */
export function plannedDueFieldHasContent(value: string, badInput: boolean): boolean {
  return value.trim() !== '' || badInput
}
