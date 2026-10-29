import type { QueryClient } from '@tanstack/react-query'
import {
  ticket,
  type InspectionRunListItem,
  type Me,
  type TicketGetOne,
  type TicketScopeParams,
  type TicketStatus,
} from './api'
import { roundTicketPath, roundTicketScope } from './roundTicketLink'

export function planFactTicketScopeKey(
  me: Pick<Me, 'id' | 'companyId' | 'role'>,
  outboundScope: TicketScopeParams,
) {
  return [
    'inspection-plan-fact-tickets',
    me.id,
    me.companyId,
    me.role,
    // Строковые слоты: объект {} в partial query-key совпал бы с любым контуром.
    outboundScope.companyId || '',
    outboundScope.linkedClientCompanyId || '',
  ] as const
}

/** Обновить раскрытые заявки даже при неизменном run.updatedAt, не очищая данные. */
export async function refreshPlanFactData(
  client: QueryClient,
  refetchSources: () => Promise<{ isError: boolean }>,
  me: Pick<Me, 'id' | 'companyId' | 'role'>,
  outboundScope: TicketScopeParams,
) {
  const result = await refetchSources()
  if (result.isError) return
  await client.invalidateQueries(
    {
      queryKey: planFactTicketScopeKey(me, outboundScope),
      refetchType: 'active',
    },
    // Уже выполняющийся GET не отменяется и не дублируется повторным кликом.
    { cancelRefetch: false },
  )
}

export const PLAN_FACT_TICKET_LIMIT = 10
export type PlanFactTicket = {
  id: string
  number: number | null
  status: TicketStatus
  href: string
}
export type PlanFactTicketResult = {
  tickets: PlanFactTicket[]
  unavailable: number
  deferred: number
}

/** Никаких fallback-данных из inspection.item.ticket: только успешный канонический GET. */
export async function loadPlanFactTickets(
  input: {
    run: InspectionRunListItem
    me: Pick<Me, 'companyId' | 'role'>
    outboundScope: TicketScopeParams
  },
  getTicket: (
    id: string,
    scope: TicketScopeParams,
  ) => Promise<TicketGetOne> = ticket,
): Promise<PlanFactTicketResult> {
  const { run } = input
  const ids = [
    ...new Set(
      (run.findings || []).flatMap((finding) =>
        finding.ticketId ? [finding.ticketId] : [],
      ),
    ),
  ]
  const ownerCompanyId = run.location.clientCompanyId
  if (!ownerCompanyId)
    return {
      tickets: [],
      unavailable: Math.min(ids.length, PLAN_FACT_TICKET_LIMIT),
      deferred: Math.max(0, ids.length - PLAN_FACT_TICKET_LIMIT),
    }
  const context = {
    me: input.me,
    outboundScope: input.outboundScope,
    ownerCompanyId,
  }
  const scope = roundTicketScope(context)
  const results = await Promise.all(
    ids.slice(0, PLAN_FACT_TICKET_LIMIT).map(async (id) => {
      try {
        const value = await getTicket(id, scope)
        // Fail closed при несовпадении связанной записи, даже если сервер ответил 200.
        if (
          value.id !== id ||
          value.companyId !== ownerCompanyId ||
          value.location?.id !== run.location.id
        )
          return null
        return {
          id,
          number: value.ticketNumber ?? null,
          status: value.status,
          href: roundTicketPath(id, context),
        }
      } catch {
        // Отказ, сеть и удалённая заявка не превращаются в «устранено» и не раскрывают error body.
        return null
      }
    }),
  )
  return {
    tickets: results.filter((value): value is PlanFactTicket => value !== null),
    unavailable: results.filter((value) => value === null).length,
    deferred: Math.max(0, ids.length - PLAN_FACT_TICKET_LIMIT),
  }
}

export function planFactTicketStatus(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    NEW: 'Новая',
    ASSIGNED: 'Назначена',
    IN_PROGRESS: 'В работе',
    AWAITING_ACCEPTANCE: 'Ожидает приёмки',
    FIELD_COMPLETE: 'Работы на объекте завершены',
    DONE: 'Завершена',
    CANCELED: 'Отменена — не подтверждение устранения',
  }
  return labels[status] || 'Статус не определён'
}
