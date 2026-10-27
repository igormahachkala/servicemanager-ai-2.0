import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildTicketNavContext,
  currentHistoryIdx,
  readTicketNavContext,
  readTicketNavRestoreKey,
  readTicketNavSnapshot,
  resolveTicketBack,
  saveTicketNavSnapshot,
  ticketNavOriginCaption,
  ticketNavSourceLabel,
  type TicketNavContext,
  type TicketNavSource,
} from './ticketNavContext'

const SCROLL_RESTORE_TIMEOUT_MS = 2500
const SCROLL_SAVE_DELAY_MS = 150
/** restoreKey → location.key записи, которая его использовала. */
const consumedRestoreKeys = new Map<string, string>()
let leftDocumentEntry = false

/**
 * Первая запись истории у React Router всегда с ключом 'default'. Снимок под
 * этим ключом мог остаться от прошлого открытия вкладки, поэтому при свежем
 * открытии документа, пока с первой записи не уходили, его не применяем.
 * При перезагрузке и при возврате на неё — применяем.
 */
function isFreshDocumentEntry(key: string): boolean {
  if (key !== 'default') {
    leftDocumentEntry = true
    return false
  }
  if (leftDocumentEntry) return false
  const entry = typeof performance !== 'undefined' ? performance.getEntriesByType?.('navigation')[0] : undefined
  return (entry as PerformanceNavigationTiming | undefined)?.type === 'navigate'
}

/**
 * Что прокручивается: в управленческой части — `main.contentMain` оболочки,
 * в мобильной — `#root`; иначе окно. Берётся тот, у кого есть что крутить.
 */
const SCROLL_CONTAINERS = ['main.contentMain', '#root']

function scrollContainer(): HTMLElement | null {
  for (const selector of SCROLL_CONTAINERS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el && el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el
  }
  return null
}

function readScrollY(): number {
  const el = scrollContainer()
  return el ? el.scrollTop : window.scrollY
}

function restoreScroll(target: number, onDone: () => void): () => void {
  if (typeof window === 'undefined' || target <= 0) {
    onDone()
    return () => {}
  }
  let cancelled = false
  let frame = 0
  const started = Date.now()
  const stop = () => {
    if (!cancelled) onDone()
    cancelled = true
    window.cancelAnimationFrame(frame)
    window.removeEventListener('wheel', stop, true)
    window.removeEventListener('touchstart', stop, true)
    window.removeEventListener('keydown', stop, true)
  }
  // Список дорисовывается после загрузки данных: ждём, пока страница
  // дорастёт до нужной высоты. Любое действие человека прекращает попытки.
  const tick = () => {
    if (cancelled) return
    const el = scrollContainer()
    const maxY = el ? el.scrollHeight - el.clientHeight : document.documentElement.scrollHeight - window.innerHeight
    if (maxY >= target || Date.now() - started > SCROLL_RESTORE_TIMEOUT_MS) {
      const y = Math.min(target, Math.max(0, maxY))
      if (el) el.scrollTop = y
      else window.scrollTo(0, y)
      stop()
      return
    }
    frame = window.requestAnimationFrame(tick)
  }
  window.addEventListener('wheel', stop, { passive: true, capture: true })
  window.addEventListener('touchstart', stop, { passive: true, capture: true })
  window.addEventListener('keydown', stop, true)
  frame = window.requestAnimationFrame(tick)
  return stop
}

/**
 * Экран-источник: отдаёт контекст для ссылок на заявку, держит снимок своего
 * состояния и прокрутки под ключом текущей записи истории и восстанавливает
 * его при возврате (Back, Forward, «Назад» в карточке).
 *
 * `restore` — сериализуемое состояние экрана, которого нет в URL (фильтры,
 * вкладка, поиск). `onRestore` получает его сырым и сам проверяет поля.
 */
export function useTicketNavSource<T>(options: {
  source: TicketNavSource
  /** Имя экрана для снимка; по умолчанию совпадает с source. */
  screen?: string
  restore?: T
  onRestore?: (raw: unknown) => void
}): TicketNavContext {
  const { source, restore, onRestore } = options
  const screen = options.screen || source
  const location = useLocation()
  const restoreJson = useMemo(() => (restore === undefined ? '' : JSON.stringify(restore)), [restore])
  /**
   * Состояние экрана на момент восстановления. Пока рендер его не сменил,
   * сохранять нельзя: эффект первого рендера записал бы в снимок значения
   * по умолчанию поверх восстанавливаемых (и StrictMode прочёл бы их же).
   */
  const staleRestoreRef = useRef<{ key: string; json: string } | null>(null)
  /** Пока прокрутка восстанавливается, в снимок пишется цель, а не текущее положение. */
  const pendingScrollRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    // Ключ из state приходит один раз — с переходом «Назад» из карточки.
    // Экран может переписывать адрес с тем же state (replace), и повторно
    // накатывать старый снимок поверх новых фильтров нельзя.
    const restoreKey = readTicketNavRestoreKey(location.state)
    const consumedBy = restoreKey ? consumedRestoreKeys.get(restoreKey) : undefined
    const useRestoreKey = !!restoreKey && (consumedBy === undefined || consumedBy === location.key)
    if (useRestoreKey) consumedRestoreKeys.set(restoreKey, location.key)
    const key = useRestoreKey ? restoreKey : location.key
    if (!useRestoreKey && isFreshDocumentEntry(location.key)) return
    const snapshot = readTicketNavSnapshot(key, screen, location.pathname)
    if (!snapshot) return
    staleRestoreRef.current = { key: location.key, json: restoreJson }
    if (snapshot.restore !== undefined && onRestore) onRestore(snapshot.restore)
    pendingScrollRef.current = snapshot.scrollY
    return restoreScroll(snapshot.scrollY, () => {
      pendingScrollRef.current = null
    })
    // Восстановление — только при входе в запись истории.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useEffect(() => {
    const save = () =>
      saveTicketNavSnapshot(location.key, {
        screen,
        pathname: location.pathname,
        scrollY: pendingScrollRef.current ?? readScrollY(),
        restore: restoreJson ? JSON.parse(restoreJson) : undefined,
      })
    let timer = 0
    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(save, SCROLL_SAVE_DELAY_MS)
    }
    // Фильтры и поиск сохраняются сразу: браузерный Back кликом по странице
    // не является, и снимок на клик его не покрывает.
    const stale = staleRestoreRef.current
    if (stale && stale.key === location.key && stale.json === restoreJson) {
      // Рендер ещё до восстановления — снимок не трогаем.
    } else {
      staleRestoreRef.current = null
      save()
    }
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('pagehide', save)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('pagehide', save)
    }
  }, [location.key, location.pathname, screen, restoreJson])

  // Снимок фиксируется в момент клика по ссылке: позже окно уже прокручено
  // карточкой. Слушатель в фазе захвата срабатывает раньше перехода.
  useEffect(() => {
    const onClick = () =>
      saveTicketNavSnapshot(location.key, {
        screen,
        pathname: location.pathname,
        scrollY: pendingScrollRef.current ?? readScrollY(),
        restore: restoreJson ? JSON.parse(restoreJson) : undefined,
      })
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [location.key, location.pathname, screen, restoreJson])

  return useMemo(
    () =>
      buildTicketNavContext({
        source,
        location,
        historyIdx: currentHistoryIdx(),
      }),
    [source, location],
  )
}

export type TicketNavBack = {
  ctx: TicketNavContext | undefined
  /** Название раздела для кнопки «Назад»; без контекста — пусто. */
  label: string
  /** Подпись «Открыто из раздела …»; без контекста — пусто. */
  caption: string
  to: string
  state: unknown
  onClick: (event: MouseEvent<HTMLElement>) => void
}

/** То, что нужно кнопке «Назад» в компонентах карточки. */
export type TicketBackLink = Pick<TicketNavBack, 'to' | 'state' | 'label' | 'onClick'>

/**
 * Карточка заявки: куда и как вести «Назад». `fallback` — прежний адрес
 * экрана на случай, когда контекста нет (прямая ссылка, push, новая вкладка).
 */
export function useTicketNavBack(fallback: { to: string; state?: unknown }): TicketNavBack {
  const location = useLocation()
  const navigate = useNavigate()
  const ctx = useMemo(() => readTicketNavContext(location.state, location.pathname), [location.state, location.pathname])
  useEffect(() => {
    isFreshDocumentEntry(location.key)
  }, [location.key])
  // idx текущей записи меняется только вместе с location.key.
  const idx = useMemo(() => (location.key ? currentHistoryIdx() : null), [location.key])

  const action = resolveTicketBack(ctx, idx, fallback)
  const to = action.kind === 'navigate' ? action.to : ctx?.returnTo || fallback.to
  const state = action.kind === 'navigate' ? action.state : undefined
  const delta = action.kind === 'history' ? action.delta : 0

  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (delta < 1) return
      event.preventDefault()
      navigate(-delta)
    },
    [delta, navigate],
  )

  return {
    ctx,
    label: ctx ? ticketNavSourceLabel(ctx.source) : '',
    caption: ctx ? ticketNavOriginCaption(ctx.source) : '',
    to,
    state,
    onClick,
  }
}
