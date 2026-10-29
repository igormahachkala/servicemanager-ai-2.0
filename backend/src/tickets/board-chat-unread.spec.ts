import { hasUnreadChat } from './board-chat-unread'

const t = (iso: string) => new Date(iso)

describe('hasUnreadChat', () => {
  const baseline = t('2026-10-29T10:00:00.000Z')

  it('нет чужих сообщений — не горит', () => {
    expect(hasUnreadChat({ latestForeignCommentAt: null, lastReadAt: null, baseline })).toBe(false)
  })

  it('без отметки прочтения порогом служит baseline', () => {
    expect(hasUnreadChat({ latestForeignCommentAt: t('2026-10-29T09:59:59.999Z'), lastReadAt: null, baseline })).toBe(false)
    expect(hasUnreadChat({ latestForeignCommentAt: baseline, lastReadAt: null, baseline })).toBe(false)
    expect(hasUnreadChat({ latestForeignCommentAt: t('2026-10-29T10:00:00.001Z'), lastReadAt: null, baseline })).toBe(true)
  })

  it('отметка прочтения позже baseline сдвигает порог', () => {
    const lastReadAt = t('2026-10-29T12:00:00.000Z')
    expect(hasUnreadChat({ latestForeignCommentAt: t('2026-10-29T11:00:00.000Z'), lastReadAt, baseline })).toBe(false)
    expect(hasUnreadChat({ latestForeignCommentAt: lastReadAt, lastReadAt, baseline })).toBe(false)
    expect(hasUnreadChat({ latestForeignCommentAt: t('2026-10-29T12:00:00.001Z'), lastReadAt, baseline })).toBe(true)
  })

  it('отметка раньше baseline порог не опускает', () => {
    const lastReadAt = t('2026-10-29T08:00:00.000Z')
    expect(hasUnreadChat({ latestForeignCommentAt: t('2026-10-29T09:00:00.000Z'), lastReadAt, baseline })).toBe(false)
  })
})
