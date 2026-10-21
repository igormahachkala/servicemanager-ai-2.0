import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

function timerLabel(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
}

export function MobileTicketWorkTimer(props: {
  ticketId: string
  ticketNumber?: number | null
  scope: api.TicketScopeParams
  enabled: boolean
}) {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    enabled: props.enabled,
    refetchInterval: 30_000,
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
  }
  const startM = useMutation({
    mutationFn: () => api.startTicketWorkLog(props.ticketId, props.scope),
    onMutate: () => setError(''),
    onSuccess: refresh,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  })
  const stopM = useMutation({
    mutationFn: () => api.stopTicketWorkLog(props.ticketId),
    onMutate: () => setError(''),
    onSuccess: refresh,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  })

  if (!props.enabled || stateQ.isError) return null
  const data = stateQ.data
  const running = data?.runningWorkLog
  const runningThisTicket = running?.ticketId === props.ticketId
  const busy = startM.isPending || stopM.isPending

  return (
    <div className="mobileCard" style={{ marginTop: 8 }}>
      <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="mobileSectionTitle">Учёт времени</div>
          <div className="mobileMeta">
            {data?.shift ? `Смена открыта с ${new Date(data.shift.openedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Смена не открыта'}
          </div>
        </div>
        {runningThisTicket && running ? <b style={{ fontFamily: 'var(--font-mono)' }}>{timerLabel(running.startedAt, now)}</b> : null}
      </div>

      {!data?.shift ? (
        <Link className="mobileBtn mobileBtnSecondary" to={mobilePath(location.pathname, '/shift')} style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
          Открыть смену
        </Link>
      ) : runningThisTicket ? (
        <button type="button" className="mobileBtn mobileBtn--done" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={() => stopM.mutate()}>
          {stopM.isPending ? 'Останавливаем…' : 'Завершить учёт времени'}
        </button>
      ) : running ? (
        <div className="mobileNotice" style={{ marginTop: 10 }}>
          Сейчас идёт учёт по заявке #{running.ticket.ticketNumber}. Сначала завершите его в той заявке.
        </div>
      ) : (
        <button type="button" className="mobileBtn mobileBtn--start" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={() => startM.mutate()}>
          {startM.isPending ? 'Запускаем…' : `Начать учёт по заявке #${props.ticketNumber || ''}`}
        </button>
      )}
      {error ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{error}</div> : null}
    </div>
  )
}
