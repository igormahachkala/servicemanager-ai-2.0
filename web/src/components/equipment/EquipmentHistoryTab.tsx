import { useInfiniteQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { EquipmentHistoryRecord } from './EquipmentHistoryRecord'

/** Technical equipment history; ticket details retain their independent access path. */
export function EquipmentHistoryTab({ equipmentId, scopeCompanyId }: {
  equipmentId: string
  scopeCompanyId?: string
}) {
  const q = useInfiniteQuery({
    queryKey: ['equipment-history', equipmentId, scopeCompanyId || ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getEquipmentHistory(equipmentId, scopeCompanyId || undefined, { cursor: pageParam }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  })

  if (q.isLoading) return <div className="muted small">Загрузка истории…</div>
  if (q.isError) return <div className="alert">{q.error.message}</div>

  const entries = (q.data?.pages || []).flatMap((page) => page.tickets)
  if (entries.length === 0) return <div className="muted small">Записей в истории обслуживания пока нет.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="muted small">История обращений и зафиксированных работ. Дата обращения не означает завершения ремонта.</div>
      {entries.map((entry) => <EquipmentHistoryRecord key={entry.ticketId} entry={entry} />)}
      {q.hasNextPage ? (
        <button className="ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
        </button>
      ) : <div className="muted small">История показана полностью. Записей: {entries.length}.</div>}
    </div>
  )
}
