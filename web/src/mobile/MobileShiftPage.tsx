import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

function durationLabel(start: string, end?: string | null, now = Date.now()) {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : now
  const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`
}

function dateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileShiftPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    refetchInterval: 30_000,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
    await queryClient.invalidateQueries({ queryKey: ['workforce-report'] })
  }

  const openM = useMutation({
    mutationFn: api.openWorkShift,
    onMutate: () => setError(''),
    onSuccess: refresh,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  })
  const closeM = useMutation({
    mutationFn: () => api.closeWorkShift(),
    onMutate: () => setError(''),
    onSuccess: refresh,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  })

  const data = stateQ.data
  const shift = data?.shift
  const running = data?.runningWorkLog
  const busy = openM.isPending || closeM.isPending
  const totalWorkMinutes = useMemo(
    () =>
      (shift?.workLogs || []).reduce(
        (sum, log) => sum + (log.durationMinutes ?? Math.max(1, Math.ceil((now - new Date(log.startedAt).getTime()) / 60_000))),
        0,
      ),
    [now, shift?.workLogs],
  )

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Рабочая смена</h1>
        <div className="mobileSubtitle">
          Учёт рабочего дня и фактического времени по заявкам. Автозакрытие: {data?.company.shiftAutoCloseTime || '19:00'}.
        </div>
      </div>

      {stateQ.isLoading ? <div className="mobileCard mobileMeta">Загрузка смены…</div> : null}
      {stateQ.isError ? <div className="mobileNotice mobileNoticeError">{(stateQ.error as Error)?.message || 'Смена недоступна'}</div> : null}
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}

      {data && !shift ? (
        <div className="mobileCard" style={{ textAlign: 'center' }}>
          <div className="mobileSectionTitle">Смена не открыта</div>
          <p className="mobileHint">Откройте смену перед началом работы по заявкам.</p>
          <button type="button" className="mobileBtn" disabled={busy} onClick={() => openM.mutate()}>
            {openM.isPending ? 'Открываем…' : 'Открыть смену'}
          </button>
        </div>
      ) : null}

      {shift ? (
        <div className="mobileCard">
          <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="mobileSectionTitle">Смена открыта</div>
              <div className="mobileMeta">С {dateTime(shift.openedAt)}</div>
            </div>
            <span className="mobileStatusPill mobileStatusPill--inProgress">{durationLabel(shift.openedAt, null, now)}</span>
          </div>
          <div className="mobileProfileStats" style={{ marginTop: 14 }}>
            <div className="mobileProfileStat">
              <div className="mobileProfileStatValue">{shift.workLogs.length}</div>
              <div className="mobileProfileStatLabel">Работ</div>
            </div>
            <div className="mobileProfileStat">
              <div className="mobileProfileStatValue">{totalWorkMinutes}</div>
              <div className="mobileProfileStatLabel">Минут по заявкам</div>
            </div>
          </div>
          {running ? (
            <div className="mobileNotice" style={{ marginTop: 12 }}>
              Сейчас учитывается заявка #{running.ticket.ticketNumber}: {running.ticket.problemCategory?.name || running.ticket.problemText}
            </div>
          ) : (
            <p className="mobileHint">Активного таймера по заявке нет. Запустите его из карточки назначенной вам заявки.</p>
          )}
          <div className="mobileFormSubmitStack">
            <Link className="mobileBtn mobileBtnSecondary" to={mobilePath(location.pathname, '/my')} style={{ textAlign: 'center' }}>
              Открыть мои заявки
            </Link>
            <button type="button" className="mobileBtn mobileBtnGhost" disabled={busy} onClick={() => closeM.mutate()}>
              {closeM.isPending ? 'Закрываем…' : 'Закрыть смену'}
            </button>
          </div>
        </div>
      ) : null}

      {data?.recentShifts.length ? (
        <div>
          <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Последние смены</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.recentShifts.map((item) => (
              <div key={item.id} className="mobileCard">
                <div className="mobileRow">
                  <div>
                    <div style={{ fontWeight: 800 }}>{dateTime(item.openedAt)}</div>
                    <div className="mobileMeta">{item.status === 'AUTO_CLOSED' ? 'Закрыта автоматически' : 'Закрыта сотрудником'}</div>
                  </div>
                  <div className="mobileMeta">{durationLabel(item.openedAt, item.closedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
