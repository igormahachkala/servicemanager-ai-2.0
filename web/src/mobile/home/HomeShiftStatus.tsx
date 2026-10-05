import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { formatMobileMutationError } from '../mobileActionErrors'
import { homeShiftView, shouldShowHomeShiftStatus } from './shiftStatusView'

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1 — постоянный компактный статус смены на Главной.
 * Читает тот же ['workforce-me'], что и shift-gate (общий кэш, без второго
 * механизма). После закрытия модалки информация о смене остаётся здесь.
 */
export function HomeShiftStatus({ role }: { role?: api.Role | null }) {
  const queryClient = useQueryClient()
  const [nowMs, setNowMs] = useState(() => Date.now())

  const isSubject = shouldShowHomeShiftStatus(role)

  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    enabled: isSubject,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  })

  // Живой минутный тик для длительности. Чистим при размонтировании.
  useEffect(() => {
    if (!isSubject) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [isSubject])

  const openM = useMutation({
    mutationFn: api.openWorkShift,
    onSuccess: (data) => {
      queryClient.setQueryData(['workforce-me'], data)
      void queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
    },
  })

  if (!isSubject) return null

  const view = homeShiftView(stateQ.data, nowMs)

  return (
    <div className={`mobileHomeShiftChip${view.state === 'active' ? ' mobileHomeShiftChip--active' : ''}`} role="status">
      <span className="mobileHomeShiftDot" aria-hidden />
      {view.state === 'active' ? (
        <span className="mobileHomeShiftText">Смена идёт · {view.durationLabel}</span>
      ) : view.state === 'inactive' ? (
        <>
          <span className="mobileHomeShiftText">Смена не начата</span>
          <button
            type="button"
            className="mobileBtn mobileHomeShiftBtn"
            disabled={openM.isPending}
            onClick={() => openM.mutate()}
          >
            {openM.isPending ? 'Открываем…' : 'Начать смену'}
          </button>
        </>
      ) : (
        <span className="mobileHomeShiftText">Смена: загрузка…</span>
      )}
      {openM.isError ? (
        <span className="mobileHomeShiftError">{formatMobileMutationError(openM.error, { operation: 'other' })}</span>
      ) : null}
    </div>
  )
}
