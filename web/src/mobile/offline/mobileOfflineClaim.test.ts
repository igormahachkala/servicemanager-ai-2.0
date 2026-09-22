import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ticketPage = readFileSync(new URL('../MobileTicketPage.tsx', import.meta.url), 'utf8')
const homePage = readFileSync(new URL('../home/MobileHome.tsx', import.meta.url), 'utf8')
const router = readFileSync(new URL('../../router.tsx', import.meta.url), 'utf8')

describe('physical iPhone offline claim guard', () => {
  it('keeps claim online-only with a Russian local refusal', () => {
    expect(ticketPage).toMatch(/if \(!getOnlineStatus\(\)\)[\s\S]*Для этого действия нужен интернет\./)
    expect(homePage).toMatch(/if \(!isOnline && ticket\.status === 'NEW'\)[\s\S]*Для этого действия нужен интернет\./)
  })

  it('does not change the online canonical claim endpoint', () => {
    expect(ticketPage).toMatch(/techActionM\.mutate\(mode\)/)
    expect(homePage).toMatch(/actionM\.mutate\(ticket\)/)
    expect(ticketPage).toMatch(/api\.claimTicket\(ticket\.id, ticketResourceScope\)/)
  })

  it('contains dynamic-import failures inside the lazy route boundary', () => {
    expect(router).toMatch(/ErrorBoundary FallbackComponent=\{LazyRouteFailure\}/)
    expect(router).toMatch(/if \(!isDynamicImportFailure\(error\)\) throw error/)
    expect(router).toContain('Повторить')
  })
})
