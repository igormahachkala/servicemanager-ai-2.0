import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { safeRemoveItem } from '../lib/browserStorage'
import { mobilePath } from './mobileRoute'
import { useOfflineStatus } from './offline/useOffline'
import {
  ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE,
  SHIFT_GATE_DISMISSAL_STORAGE_AREA,
  shiftGateDayKey,
  shiftGateDismissalKey,
} from './mobileShiftGate'
import {
  TODAY_COUNT_LABELS,
  groupOpenTicketCounts,
  resolveStartFailure,
  todayWindow,
  toTodayVisitCards,
  type TodayVisitCard,
} from './mobileInspectionToday'

/**
 * SMA-PLANNER-V1-MOBILE-TODAY-120G — план визитов на сегодня.
 *
 * Экран читается без открытой смены: план — это информация, а не работа.
 * Смену требует только запуск обхода, и требует её бэкенд, а не эта страница.
 */

/** Tabler calendar-event: плитка визита. */
function VisitIcon({ tone }: { tone: string }) {
  return (
    <span className={`mobilePatrolIcon mobilePatrolIcon--${tone}`} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
        <path d="M16 3v4M8 3v4M4 11h16M8 15h2v2h-2z" />
      </svg>
    </span>
  )
}

function toneOf(card: TodayVisitCard): string {
  if (card.state === 'IN_PROGRESS') return 'inprogress'
  if (card.state === 'COMPLETED') return 'completed'
  return 'planned'
}

export function MobileInspectionTodayPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const offline = useOfflineStatus()

  const [notice, setNotice] = useState<string | null>(null)
  const [pendingScheduleId, setPendingScheduleId] = useState<string | null>(null)

  /**
   * Окно суток считается один раз на монтирование: пересчёт на каждом рендере
   * менял бы ключ запроса и перезагружал список без причины.
   */
  const window = useMemo(() => todayWindow(), [])

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  /**
   * Сужение по технику делает сервер: assignedToUserId отсюда не передаётся
   * намеренно. Клиентский фильтр здесь был бы не ограничением, а его имитацией.
   */
  const schedulesQ = useQuery({
    queryKey: ['mobile-inspection-today', window.from, window.to],
    queryFn: () => api.getInspectionSchedules({ from: window.from, to: window.to, active: true }),
  })

  /**
   * Счётчики берутся из того же board, что уже грузит главная: один запрос на
   * экран, а не по запросу на объект. Охват board у техника сужен бэкендом,
   * поэтому это его заявки, и подпись говорит именно так.
   */
  const boardQ = useQuery({
    queryKey: ['mobile-inspection-today-board'],
    queryFn: () => api.board({ take: 500 }),
    enabled: offline.online,
  })

  const counts = useMemo(() => {
    const cards = boardQ.data?.columns.flatMap((column) => column.cards || []) || []
    return groupOpenTicketCounts(cards)
  }, [boardQ.data])

  const visits = useMemo(
    () => toTodayVisitCards(schedulesQ.data, counts),
    [schedulesQ.data, counts],
  )

  const startM = useMutation({
    mutationFn: api.startInspectionRun,
    onSuccess: async (run) => {
      setNotice(null)
      setPendingScheduleId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-inspection-today'] })
      queryClient.setQueryData(['inspection-run', run.id], run)
      navigate(mobilePath(location.pathname, `/inspection/${run.id}`))
    },
    onError: async (cause: unknown) => {
      setPendingScheduleId(null)
      const failure = resolveStartFailure(cause)

      if (failure.kind === 'open') {
        // Визит уже начат — ведём к нему, а не показываем тупик.
        setNotice(null)
        navigate(mobilePath(location.pathname, `/inspection/${failure.runId}`))
        return
      }

      if (failure.kind === 'retry') {
        setNotice('Запуск уже выполняется. Повторите через несколько секунд.')
        return
      }

      if (failure.kind === 'shift') {
        /**
         * Запрос на открытие смены живёт в оболочке. Снимаем сегодняшний отказ
         * от него и обновляем состояние смены, чтобы он снова показался.
         */
        const companyId = meQ.data?.companyId || ''
        if (meQ.data?.id && companyId) {
          safeRemoveItem(
            SHIFT_GATE_DISMISSAL_STORAGE_AREA,
            shiftGateDismissalKey({ userId: meQ.data.id, companyId, dayKey: shiftGateDayKey() }),
          )
        }
        await queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
        setNotice(ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE)
        return
      }

      setNotice(failure.message)
    },
  })

  function startVisit(card: TodayVisitCard) {
    if (!offline.online) {
      setNotice('Начать новый обход можно только онлайн. Уже начатые обходы доступны офлайн.')
      return
    }
    setNotice(null)
    setPendingScheduleId(card.scheduleId)
    startM.mutate({
      templateId: card.templateId,
      locationId: card.locationId,
      ...(card.equipmentId ? { equipmentId: card.equipmentId } : {}),
      scheduleId: card.scheduleId,
    })
  }

  const content = (() => {
    if (schedulesQ.isLoading) {
      return <div className="mobileCard mobileMeta">Загружаем план на сегодня…</div>
    }
    if (schedulesQ.isError) {
      return (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить план на сегодня.{' '}
          <button type="button" className="mobileBtn mobileBtnGhost" onClick={() => schedulesQ.refetch()}>
            Повторить
          </button>
        </div>
      )
    }
    if (visits.length === 0) {
      return (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">На сегодня обходов не запланировано</div>
          <p className="mobileEmptyStateHint">
            Внеплановый обход можно начать через «Начать обход».
          </p>
          <Link to={mobilePath(location.pathname, '/inspection/start')} className="mobileBtn mobileBtnGhost">
            Начать обход
          </Link>
        </div>
      )
    }

    return (
      <>
        {visits.map((card) => {
          const busy = startM.isPending && pendingScheduleId === card.scheduleId
          return (
            <div key={card.scheduleId} className="mobileCard mobilePatrolCard">
              <div className="mobilePatrolCardTop">
                <VisitIcon tone={toneOf(card)} />
                <div className="mobilePatrolCardTitle">{card.locationName}</div>
                {card.plannedTime ? (
                  <span className="mobilePatrolRunStatus mobilePatrolRunStatus--planned">{card.plannedTime}</span>
                ) : null}
              </div>

              {card.addressLine ? <div className="mobilePatrolCardMeta">{card.addressLine}</div> : null}
              <div className="mobilePatrolCardMeta">{card.templateName}</div>

              <div className="mobilePatrolCardMeta" title={TODAY_COUNT_LABELS.scopeNote}>
                <span>
                  {TODAY_COUNT_LABELS.nonUrgent}: {card.counts.nonUrgent}
                </span>
                {card.counts.urgent > 0 ? (
                  <span className="mobilePatrolReportBadge mobilePatrolReportBadge--rejected">
                    {TODAY_COUNT_LABELS.urgent}: {card.counts.urgent}
                  </span>
                ) : null}
              </div>

              {card.state === 'COMPLETED' ? (
                <div className="mobilePatrolCardMeta">{card.actionLabel}</div>
              ) : card.state === 'IN_PROGRESS' && card.runId ? (
                <Link
                  to={mobilePath(location.pathname, `/inspection/${card.runId}`)}
                  className="mobileBtn mobileBtnGhost"
                  style={{ textAlign: 'center', marginTop: 2 }}
                >
                  {card.actionLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  className="mobileBtn"
                  style={{ marginTop: 2 }}
                  disabled={busy || !offline.online}
                  onClick={() => startVisit(card)}
                >
                  {busy ? 'Начинаем…' : card.actionLabel}
                </button>
              )}
            </div>
          )
        })}
      </>
    )
  })()

  return (
    <div className="mobileSection">
      <div className="mobileInspectionListHeader">
        <div>
          <h1 className="mobileTitle">Сегодня</h1>
          <div className="mobileSubtitle">Запланированные визиты</div>
        </div>
        <Link to={mobilePath(location.pathname, '/inspection')} className="mobileBtn mobileBtnGhost">
          Все обходы
        </Link>
      </div>

      {!offline.online ? (
        <div className="mobileNotice">
          Нет сети: план показан по сохранённым данным. Начать новый обход можно только онлайн.
        </div>
      ) : null}
      {notice ? <div className="mobileNotice mobileNoticeError">{notice}</div> : null}

      {content}
    </div>
  )
}

export default MobileInspectionTodayPage
