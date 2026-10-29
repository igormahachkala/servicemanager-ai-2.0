import { resolveChatReadAt } from './ticket-chat-read.service'

describe('resolveChatReadAt', () => {
  const now = new Date('2026-10-29T12:00:00.000Z')

  it('без upTo — время сервера', () => {
    expect(resolveChatReadAt(undefined, now)).toBe(now)
  })

  it('upTo в прошлом сохраняется как есть', () => {
    expect(resolveChatReadAt('2026-10-29T11:59:00.000Z', now).toISOString()).toBe('2026-10-29T11:59:00.000Z')
  })

  it('upTo из будущего обрезается временем сервера', () => {
    expect(resolveChatReadAt('2026-10-29T13:00:00.000Z', now)).toBe(now)
  })

  it('неразборчивое значение — время сервера', () => {
    expect(resolveChatReadAt('не дата', now)).toBe(now)
  })
})
