import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { offlineTicketCommentOptions } from './offline/transport'
import type { ChatMessage } from '../lib/ticketChat'
import {
  UNAVAILABLE_REPLY_PREVIEW_TEXT,
  actorReplyLabel,
  buildAddTicketCommentOptions,
  buildOfflineTicketCommentPayload,
  canReplyToChatMessage,
  messageReplyContext,
  replyPreviewPresentation,
  selectReplyTarget,
} from '../lib/ticketReplyUi'

/**
 * SMA-TICKET-REPLY-MOBILE-UI-121G.
 *
 * Мобильный ответ пользуется теми же решениями, что и desktop, поэтому здесь
 * проверяется ровно две вещи: что общие помощники дают нужный ответ, и что
 * экран действительно к ним обращается, а не решает заново. Среда тестов node,
 * DOM нет — именно поэтому решения живут в чистом модуле.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const page = () => readSrc('mobile/MobileTicketPage.tsx')
const transport = () => readSrc('mobile/offline/transport.ts')

/**
 * Личность собирается каноническим presentActorIdentity: организация берётся
 * из actor.company, а имя он выводит в порядке «фамилия имя». Переопределять
 * это здесь нельзя — иначе у ответа появится своё представление личности.
 */
const ACTOR = {
  id: 'u-1',
  email: 'master@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'MASTER',
  company: { id: 'c-1', name: 'ИП Ермаков', type: 'PROVIDER' },
} as never

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'comment-2026-09-17T10:00:00.000Z-3',
    at: '2026-09-17T10:00:00.000Z',
    text: 'Не работает холодильник в зале',
    authorId: 'u-1',
    authorEmail: 'master@example.com',
    actor: ACTOR,
    isOwn: false,
    kind: 'comment',
    commentId: 'tc-42',
    replyTo: null,
    ...overrides,
  } as ChatMessage
}

// ── 1-3. кому можно ответить ───────────────────────────────────────────────

describe('121G право на ответ', () => {
  it('1. устойчивый комментарий отвечаем', () => {
    expect(canReplyToChatMessage(message(), true)).toBe(true)
    expect(selectReplyTarget(message(), true)?.commentId).toBe('tc-42')
  })

  it('2. исторический комментарий без commentId не отвечаем', () => {
    const historical = message({ commentId: null })
    expect(canReplyToChatMessage(historical, true)).toBe(false)
    expect(selectReplyTarget(historical, true)).toBeNull()
  })

  it('3. системные и фото-сообщения не отвечаем', () => {
    for (const kind of ['system', 'photo'] as const) {
      expect(canReplyToChatMessage(message({ kind }), true)).toBe(false)
    }
  })

  it('без права комментировать «Ответить» не появляется ни у кого', () => {
    expect(canReplyToChatMessage(message(), false)).toBe(false)
  })
})

// ── 6-7. что уходит на сервер ──────────────────────────────────────────────

describe('121G цель ответа в запросе', () => {
  it('6. отправляется ровно выбранный commentId', () => {
    expect(buildAddTicketCommentOptions(message())).toEqual({ replyToId: 'tc-42' })
  })

  it('обычный комментарий уходит без replyToId', () => {
    expect(buildAddTicketCommentOptions(null)).toBeUndefined()
    expect(api.buildAddTicketCommentBody('текст')).toEqual({ comment: 'текст' })
    expect(api.buildAddTicketCommentBody('текст', { replyToId: 'tc-42' })).toEqual({
      comment: 'текст',
      replyToId: 'tc-42',
    })
  })

  /**
   * 121F, пробел 1. ChatMessage.id у исторической записи собран на клиенте
   * из времени и позиции в массиве. Подставить его вместо отсутствующего
   * commentId нельзя: сервер такой цели не найдёт.
   */
  it('7. синтетический ChatMessage.id целью ответа не становится', () => {
    for (const syntheticId of [
      'comment-2026-09-17T10:00:00.000Z-3',
      '2026-09-17T10:00:00.000Z#7',
      '1758103200000-12',
      'history-3',
    ]) {
      const historical = message({ commentId: null, id: syntheticId })
      const options = buildAddTicketCommentOptions(historical)
      expect(options).toBeUndefined()
      expect(JSON.stringify(options ?? {})).not.toContain(syntheticId)
      expect(api.buildAddTicketCommentBody('текст', options)).toEqual({ comment: 'текст' })
    }
  })

  it('7. и в офлайн-очередь синтетический id тоже не попадает', () => {
    const historical = message({ commentId: null, id: 'comment-2026-09-17T10:00:00.000Z-3' })
    const payload = buildOfflineTicketCommentPayload('текст', { companyId: 'c-1' }, historical)
    expect(payload).toEqual({ comment: 'текст', scope: { companyId: 'c-1' } })
    expect(JSON.stringify(payload)).not.toContain(historical.id)
  })
})

// ── 8-9. предпросмотр исходного сообщения ──────────────────────────────────

describe('121G предпросмотр исходного сообщения', () => {
  it('8. недоступное исходное сообщение называется точным текстом', () => {
    const view = replyPreviewPresentation({ id: 'tc-1', author: null, bodyPreview: '', unavailable: true })
    expect(view.unavailable).toBe(true)
    expect(view.preview).toBe('Исходное сообщение недоступно')
    expect(view.preview).toBe(UNAVAILABLE_REPLY_PREVIEW_TEXT)
    expect(view.author).toBeNull()
  })

  it('9. текст недоступного сообщения наружу не выходит даже если бэкенд его прислал', () => {
    const secret = 'Внутренняя переписка другого арендатора'
    const view = replyPreviewPresentation({
      id: 'tc-1',
      author: ACTOR,
      bodyPreview: secret,
      unavailable: true,
    })
    expect(view.preview).toBe(UNAVAILABLE_REPLY_PREVIEW_TEXT)
    expect(JSON.stringify(view)).not.toContain(secret)
    expect(view.author).toBeNull()
  })

  it('доступный предпросмотр показывает автора и текст от бэкенда', () => {
    const view = replyPreviewPresentation({
      id: 'tc-1',
      author: ACTOR,
      bodyPreview: 'Не работает холодильник…',
      unavailable: false,
    })
    expect(view.author).toBe('Петров Иван · Мастер подрядчика · ИП Ермаков')
    expect(view.preview).toBe('«Не работает холодильник…»')
  })
})

// ── 10-11. личность автора ─────────────────────────────────────────────────

describe('121G личность автора', () => {
  it('10. имя, роль и организация берутся каноническими помощниками', () => {
    const label = messageReplyContext(message()).author
    for (const part of ['Петров Иван', 'Мастер подрядчика', 'ИП Ермаков']) expect(label).toContain(part)
    expect(label).toBe('Петров Иван · Мастер подрядчика · ИП Ермаков')
  })

  /** 120L, минорный пробел: автор есть, а роли и организации у него нет. */
  it('11. отсутствующие поля личности заменяются нейтральными словами', () => {
    expect(actorReplyLabel(null)).toBe('Автор не указан')
    const partial = actorReplyLabel({ id: 'u-2', email: 'x@example.com', firstName: 'Пётр', lastName: 'Сидоров' } as never)
    expect(partial).toContain('Сидоров Пётр')
    expect(partial).toContain('Роль не указана')
    expect(partial).toContain('Организация не указана')

    // Автор без имени: остаётся нейтральное слово, а не пустая строка и не id.
    const nameless = actorReplyLabel({ id: 'u-3', company: { id: 'c-1', name: 'ИП Ермаков', type: 'PROVIDER' } } as never)
    expect(nameless).toContain('Автор не указан')
    expect(nameless).toContain('ИП Ермаков')
    expect(nameless).not.toContain('u-3')
  })
})

// ── 14-16. офлайн ──────────────────────────────────────────────────────────

describe('121G офлайн-очередь', () => {
  it('14. payload несёт replyToId, когда ответ выбран', () => {
    expect(buildOfflineTicketCommentPayload('текст', { companyId: 'c-1' }, message())).toEqual({
      comment: 'текст',
      scope: { companyId: 'c-1' },
      replyToId: 'tc-42',
    })
  })

  it('15. обычный комментарий кладётся в очередь прежним телом', () => {
    expect(buildOfflineTicketCommentPayload('текст', { companyId: 'c-1' }, null)).toEqual({
      comment: 'текст',
      scope: { companyId: 'c-1' },
    })
  })

  it('16. повтор сохраняет тот же ключ идемпотентности и ту же цель', () => {
    const payload = buildOfflineTicketCommentPayload('текст', undefined, message())
    // Ключ принадлежит записи очереди и при повторе не пересоздаётся.
    const first = offlineTicketCommentOptions(payload, 'key-1')
    const retry = offlineTicketCommentOptions(payload, 'key-1')
    expect(first).toEqual({ idempotencyKey: 'key-1', replyToId: 'tc-42' })
    expect(retry).toEqual(first)

    // Обычный комментарий из очереди — только ключ, тело прежнее.
    const plain = offlineTicketCommentOptions({ comment: 'текст' }, 'key-2')
    expect(plain).toEqual({ idempotencyKey: 'key-2' })
    expect(api.buildAddTicketCommentBody('текст', plain)).toEqual({ comment: 'текст' })
  })

  it('16. второго вида записи в очереди не появляется', () => {
    expect((transport().match(/case 'ticket\.comment'/g) || []).length).toBe(1)
    expect(transport()).not.toMatch(/ticket\.reply/)
    expect(transport()).toMatch(/offlineTicketCommentOptions\(item\.payload, key\)/)
    expect((page().match(/kind: 'ticket\.comment'/g) || []).length).toBe(1)
  })
})

// ── 17. ровно один запрос ──────────────────────────────────────────────────

describe('121G сеть', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * 121F, пробел 2. Ответ — это обычный комментарий. Второго запроса,
   * отдельного события и обращения к уведомлениям быть не должно.
   */
  it('17. отправка ответа делает ровно один запрос — POST на комментарии', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body })
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) } as never
    })

    await api.addTicketComment('t-1', 'Ответ', undefined, { replyToId: 'tc-42', idempotencyKey: 'key-1' })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/tickets/t-1/comments')
    expect(JSON.parse(String(calls[0].body))).toEqual({ comment: 'Ответ', replyToId: 'tc-42' })

    for (const call of calls) {
      expect(call.url).not.toContain('/notifications')
      expect(call.url).not.toContain('reply_added')
      expect(call.url).not.toContain('/replies')
    }
  })

  it('17. обычный комментарий — тот же единственный запрос и прежнее тело', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(String(url))
      void init
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) } as never
    })

    await api.addTicketComment('t-1', 'Просто комментарий')

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/tickets/t-1/comments')
  })

  it('17. в исходниках ответа нет ни отдельного события, ни запроса к уведомлениям', () => {
    const sources = [page(), readSrc('lib/ticketReplyUi.ts'), transport()]
    for (const source of sources) {
      expect(source).not.toContain('reply_added')
      expect(source).not.toMatch(/\/notifications['"`][^)]*\{\s*method/)
      expect(source).not.toMatch(/api\.(markNotification|notifications|notifyReply)\(/)
      expect(source).not.toMatch(/request<[^>]*>\(\s*['"`]\/notifications/)
    }
    /*
     * '/notifications' на экране встречается только как канонический путь
     * возврата к списку уведомлений (116E) — это навигация, а не запрос.
     */
    for (const hit of page().match(/[^\n]*\/notifications[^\n]*/g) || []) {
      expect(hit).toMatch(/mobilePath/)
    }
    // Единственная отправка комментария на экране — одна.
    expect((page().match(/api\.addTicketComment\(/g) || []).length).toBe(2)
  })
})

// ── 4-5, 12-13. экран обращается к общим решениям ──────────────────────────

describe('121G source contract мобильного экрана', () => {
  it('4. «Ответить» и контекст над полем ввода строятся общими помощниками', () => {
    const source = page()
    expect(source).toMatch(/canReplyToChatMessage\(msg, canSendComment\)/)
    expect(source).toMatch(/setReplyTarget\(selectReplyTarget\(msg, canSendComment\)\)/)
    expect(source).toMatch(/Ответить/)
    expect(source).toMatch(/messageReplyContext\(replyTarget\)\.author/)
    expect(source).toMatch(/messageReplyContext\(replyTarget\)\.preview/)
    expect(source).toMatch(/canSendComment && replyTarget \?/)
  })

  it('5. «Отменить» снимает цель', () => {
    expect(page()).toMatch(/onClick=\{\(\) => setReplyTarget\(null\)\}[\s\S]{0,120}Отменить/)
  })

  it('12. успешная отправка снимает и текст, и цель', () => {
    const source = page()
    const send = source.slice(source.indexOf('async function handleChatSend'), source.indexOf('async function handleChatSend') + 1800)
    const online = send.slice(send.indexOf('await api.addTicketComment'))
    expect(online).toMatch(/setChatText\(''\)/)
    expect(online).toMatch(/setReplyTarget\(null\)/)
    expect(online).toMatch(/buildAddTicketCommentOptions\(replyTarget\)/)
  })

  it('13. отказ сохраняет и текст, и цель', () => {
    const source = page()
    const send = source.slice(source.indexOf('async function handleChatSend'), source.indexOf('async function handleChatSend') + 1800)
    const failure = send.slice(send.indexOf('} catch (e: unknown) {'))
    expect(failure).toMatch(/setChatSendError/)
    // В ветке отказа нет ни очистки текста, ни снятия цели.
    expect(failure).not.toMatch(/setChatText\(''\)/)
    expect(failure).not.toMatch(/setReplyTarget\(null\)/)
  })

  it('предпросмотр берётся только у бэкенда: локального поиска исходного сообщения нет', () => {
    const source = page()
    expect(source).toMatch(/msg\.replyTo \? <MobileChatReplyPreview replyTo=\{msg\.replyTo\}/)
    expect(source).toMatch(/replyPreviewPresentation\(replyTo\)/)
    // Ни поиска по ленте, ни сопоставления по commentId вручную.
    expect(source).not.toMatch(/chatMessages\.find/)
    expect(source).not.toMatch(/messages\.find\(/)
    expect(source).not.toMatch(/\.find\(\([a-z]+\) => [a-z]+\.commentId ===/)
  })

  it('на мобильном не появилось своей модели ответа и своего доступа', () => {
    const source = page()
    // Решение о праве на ответ принимает общий помощник, не экран.
    expect(source).not.toMatch(/kind === 'comment' && [^\n]*commentId/)
    expect(source).not.toMatch(/replyToId:\s*msg\.id/)
    expect(source).not.toMatch(/replyToId:\s*[a-zA-Z]+\.id\b/)
    expect(source).not.toMatch(/commentId \?\? [a-zA-Z]+\.id/)
    /*
     * Право на ответ решает ровно один общий помощник. Проверяется буквально
     * условие над каждой кнопкой: любое добавленное слагаемое — роль, право,
     * контур — делает условие другим, и это видно здесь.
     */
    const gates = source
      .split('\n')
      .filter((line) => line.includes('canReplyToChatMessage('))
      .map((line) => line.trim())
    expect(gates.length).toBeGreaterThanOrEqual(2)
    for (const gate of gates) {
      expect(gate).toBe('{canReplyToChatMessage(msg, canSendComment) ? (')
    }
    // И над самой кнопкой нет второго условия.
    for (const line of source.split('\n')) {
      if (!line.includes('<MobileChatReplyAction')) continue
      expect(line).not.toMatch(/role|permission|canAccess|contour|PRIMARY|SECONDARY/)
    }
  })
})
