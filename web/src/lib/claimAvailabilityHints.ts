/**
 * Человекочитаемые формулировки для meta.claimAvailabilityReason (без смены бэкенда).
 */

export type ClaimUnavailableKind =
  | 'specialization'
  | 'location'
  | 'assigned'
  | 'status_new'
  | 'claim_disabled'
  | 'scope'
  | 'policy_generic'
  | 'unknown'

const MAX_DETAIL = 220

export function classifyClaimAvailabilityReason(raw: string | null | undefined): ClaimUnavailableKind {
  const t = (raw || '').trim()
  if (!t) return 'unknown'
  const low = t.toLowerCase()
  if (t.includes('уже назначена')) return 'assigned'
  if (t.includes('не в статусе new') || low.includes('не в статусе new')) return 'status_new'
  if (t.includes('отключен') && low.includes('claim')) return 'claim_disabled'
  if (t.includes('специализац') || low.includes('specialization')) return 'specialization'
  if (t.includes('Локация заявки недоступна') || t.includes('UserLocationBinding') || t.includes('к этой точке'))
    return 'location'
  if (t.includes('operational scope') || t.includes('операцион') || t.includes('operational')) return 'scope'
  if (t.includes('Claim недоступен') || low.startsWith('claim')) return 'policy_generic'
  return 'unknown'
}

export function shortTitleForClaimUnavailable(kind: ClaimUnavailableKind): string {
  switch (kind) {
    case 'specialization':
      return 'Вы не можете взять эту заявку: категория не входит в ваши специализации.'
    case 'location':
      return 'Нет доступа к этой точке'
    case 'assigned':
      return 'Заявка уже назначена'
    case 'status_new':
      return 'Взять можно только новую необработанную заявку'
    case 'claim_disabled':
      return 'Самовыбор заявок отключён администратором'
    case 'scope':
      return 'Заявка вне вашего рабочего контура'
    case 'policy_generic':
      return 'Взять заявку сейчас нельзя по правилам доступа'
    default:
      return 'Взять заявку сейчас нельзя'
  }
}

export function truncateDetail(s: string, max = MAX_DETAIL): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Заголовок + опционально сырой/доп. текст с бэкенда. */
export function explainClaimUnavailable(raw: string | null | undefined): { title: string; detail: string | null } {
  const trimmed = (raw || '').trim()
  const kind = classifyClaimAvailabilityReason(trimmed)
  const title = shortTitleForClaimUnavailable(kind)
  if (!trimmed) return { title, detail: null }
  if (kind === 'specialization' || kind === 'location' || kind === 'scope' || kind === 'claim_disabled') {
    return { title, detail: null }
  }
  if (kind === 'unknown') return { title: shortTitleForClaimUnavailable('unknown'), detail: truncateDetail(trimmed) }
  const detail = truncateDetail(trimmed)
  if (detail.length < 24) return { title, detail: null }
  if (detail.toLowerCase().includes(title.toLowerCase().slice(0, 12))) return { title, detail: null }
  return { title, detail }
}

/** Текст на карточке доски, когда API не присылает reason (только canClaim === false). */
export function genericTechnicianBoardClaimHint(): string {
  return 'Взять самостоятельно нельзя: чаще всего не совпала специализация, нет доступа к точке или это ограничено настройками. Откройте заявку — там указана точная причина.'
}
