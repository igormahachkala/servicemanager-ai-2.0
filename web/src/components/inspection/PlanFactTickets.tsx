import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type {
  InspectionRunListItem,
  Me,
  TicketScopeParams,
} from '../../lib/api'
import {
  loadPlanFactTickets,
  planFactTicketStatus,
  planFactTicketScopeKey,
  type PlanFactTicketResult,
} from '../../lib/inspectionPlanFactTickets'

export function PlanFactTicketResults({
  result,
  findings = [],
}: {
  result: PlanFactTicketResult
  findings?: InspectionRunListItem['findings']
}) {
  return (
    <div>
      <p className="muted small">
        Статусы заявок проверены отдельно. Завершённый обход сам по себе не
        означает устранение всех неисправностей.
      </p>
      {result.tickets.map((row) => (
        <div key={row.id}>
          {findings.some((finding) => finding.ticketId === row.id) ? (
            <span>
              {findings
                .filter((finding) => finding.ticketId === row.id)
                .map((finding) => finding.title)
                .join('; ')}{' '}
              —{' '}
            </span>
          ) : null}
          <Link to={row.href}>
            {row.number == null ? 'Открыть заявку' : `Заявка №${row.number}`}
          </Link>{' '}
          — {planFactTicketStatus(row.status)}
        </div>
      ))}
      {result.unavailable > 0 ? (
        <p role="status">
          Не удалось проверить заявки: {result.unavailable}. Их статус и
          устранение неизвестны.
        </p>
      ) : null}
      {result.deferred > 0 ? (
        <p className="muted">
          Ещё {result.deferred} заявок не проверено: лимит 10 на раскрытый
          обход. Полный результат доступен в карточке обхода.
        </p>
      ) : null}
      {!result.tickets.length && !result.unavailable && !result.deferred ? (
        <p>Связанных заявок в записи нет.</p>
      ) : null}
    </div>
  )
}

export function PlanFactTickets(props: {
  run: InspectionRunListItem
  me: Me
  outboundScope: TicketScopeParams
}) {
  const query = useQuery({
    queryKey: [
      ...planFactTicketScopeKey(props.me, props.outboundScope),
      props.run.id,
      props.run.updatedAt,
    ],
    queryFn: () => loadPlanFactTickets(props),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  if (query.isPending)
    return <p role="status">Проверяем доступность и статусы заявок…</p>
  if (query.isError)
    return (
      <p role="alert">
        Не удалось проверить заявки. Статус устранения неизвестен.
      </p>
    )
  return (
    <div>
      {query.isFetching ? <p role="status">Обновляем статусы заявок…</p> : null}
      <PlanFactTicketResults
        result={query.data}
        findings={props.run.findings}
      />
    </div>
  )
}
