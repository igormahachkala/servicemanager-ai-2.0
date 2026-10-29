import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import type { ChatMessage } from '../lib/ticketChat'
import {
  CHAT_UNREAD_LIST_QUERY_KEYS,
  clearUnreadChatInBoard,
  latestChatMessageAt,
  shouldMarkChatRead,
} from '../lib/ticketChatUnread'

/**
 * Гасит 💬 заявки во всех списках: сразу в кэше и перезапросом с сервера.
 * Вызывается после своей отметки и по chat.read с другого устройства.
 */
export function applyChatReadToLists(qc: QueryClient, ticketId: string) {
  for (const queryKey of CHAT_UNREAD_LIST_QUERY_KEYS) {
    qc.setQueriesData({ queryKey }, (data: unknown) => clearUnreadChatInBoard(data, ticketId))
    qc.invalidateQueries({ queryKey })
  }
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

/**
 * Отмечает чат прочитанным, пока он открыт на экране.
 *
 * active — чат действительно показан (на мобильной карточке это вкладка «Чат»).
 * Скрытая вкладка браузера не читает: сообщение, пришедшее по WebSocket
 * в фоне, отметится, только когда пользователь вернётся на страницу.
 */
export function useTicketChatReadMark(params: {
  ticketId: string
  messages: ReadonlyArray<Pick<ChatMessage, 'at'>>
  scope?: api.TicketScopeParams
  active: boolean
}) {
  const { ticketId, messages, scope, active } = params
  const qc = useQueryClient()
  const lastMarkedRef = useRef<{ ticketId: string; at: string } | null>(null)
  const [visible, setVisible] = useState(isDocumentVisible)
  const latestAt = useMemo(() => latestChatMessageAt(messages), [messages])
  const scopeCompanyId = scope?.companyId || ''
  const scopeLinkedClientCompanyId = scope?.linkedClientCompanyId || ''

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => setVisible(isDocumentVisible())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!active || !visible || !ticketId) return
    const marked = lastMarkedRef.current
    const lastMarkedAt = marked?.ticketId === ticketId ? marked.at : null
    if (!latestAt || !shouldMarkChatRead({ latestAt, lastMarkedAt })) return

    const attempt = { ticketId, at: latestAt }
    lastMarkedRef.current = attempt
    const requestScope: api.TicketScopeParams = {
      companyId: scopeCompanyId || undefined,
      linkedClientCompanyId: scopeLinkedClientCompanyId || undefined,
    }
    api
      .markTicketChatRead(ticketId, latestAt, requestScope)
      .then(() => applyChatReadToLists(qc, ticketId))
      .catch(() => {
        // Сеть или права: следующая смена ленты либо видимости попробует снова.
        if (lastMarkedRef.current === attempt) lastMarkedRef.current = marked ?? null
      })
  }, [active, visible, ticketId, latestAt, scopeCompanyId, scopeLinkedClientCompanyId, qc])
}

/**
 * Чат на карточке заявки компьютера стоит ниже фото и подзадач: открыть
 * заявку ещё не значит увидеть переписку. Истина, пока блок чата хоть
 * частично в окне. Без IntersectionObserver считаем блок видимым.
 */
export function useElementInViewport<T extends Element>(ref: { current: T | null }, enabled = true) {
  const [inViewport, setInViewport] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      setInViewport(entries.some((entry) => entry.isIntersecting))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])
  return inViewport
}
