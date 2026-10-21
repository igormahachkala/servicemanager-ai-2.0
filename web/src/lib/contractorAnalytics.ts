import type { AnalyticsContractorsParams, ServiceContractRole } from './api'

/**
 * SMA-ANALYTICS-CONTRACTORS — решения блока «Подрядчики» без React.
 *
 * Права здесь не выдаются: что актор увидит, решает бэкенд. Здесь только
 * когда блок запрашивать и с какими параметрами области.
 */

export type ContractorScopeInput = {
  analyticsAllowedForRole: boolean
  observerCompanyId: string
  canShowLinkedClients: boolean
  linkedClientsLoading: boolean
  selectedLinkedClient: { clientCompanyId: string; role: ServiceContractRole } | null
}

export type ContractorScope = { enabled: false } | { enabled: true; params: AnalyticsContractorsParams }

/**
 * Область запроса.
 *
 * В отличие от общего обзора, SECONDARY блок получает: бэкенд отдаст ему
 * только его собственную работу. Провайдер без выбранного клиента не
 * запрашивает ничего — его «свой контур» не содержит заявок клиентов.
 */
export function contractorAnalyticsScope(input: ContractorScopeInput): ContractorScope {
  if (!input.analyticsAllowedForRole) return { enabled: false }
  if (input.observerCompanyId) return { enabled: true, params: { companyId: input.observerCompanyId } }
  if (!input.canShowLinkedClients) return { enabled: true, params: {} }
  if (input.linkedClientsLoading || !input.selectedLinkedClient) return { enabled: false }
  return { enabled: true, params: { linkedClientCompanyId: input.selectedLinkedClient.clientCompanyId } }
}

export type ContractorPeriod = '7d' | '30d' | '90d' | 'all'

export const CONTRACTOR_PERIOD_LABELS: Record<ContractorPeriod, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  all: 'Всё время',
}

const PERIOD_DAYS: Record<Exclude<ContractorPeriod, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * Начало периода — полночь ЛОКАЛЬНЫХ суток пользователя N−1 дней назад,
 * моментом ISO: бэкенд берёт момент как есть, без подгонки к суткам сервера.
 * «7 дней» — сегодня и шесть предыдущих.
 */
export function contractorPeriodRange(period: ContractorPeriod, now: Date = new Date()): { from?: string } {
  if (period === 'all') return {}
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (PERIOD_DAYS[period] - 1))
  return { from: start.toISOString() }
}

/** Доля 0..1 → «87%»; нет оценённых заявок — прочерк, а не 0%. */
export function fmtSlaRatio(ratio: number | null | undefined): string {
  if (typeof ratio !== 'number' || Number.isNaN(ratio)) return '—'
  return `${Math.round(ratio * 100)}%`
}

/** Минуты → «2 ч 15 мин» / «3 д 4 ч»; нечего считать — прочерк. */
export function fmtDurationMinutes(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes < 0) return '—'
  const total = Math.round(minutes)
  if (total < 60) return `${total} мин`
  const hours = Math.floor(total / 60)
  if (hours < 24) {
    const rest = total % 60
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} д ${restHours} ч` : `${days} д`
}

export function contractorRoleLabel(role: ServiceContractRole): string {
  return role === 'PRIMARY' ? 'Основной' : 'Субподрядчик'
}
