import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ticketPage = readFileSync(new URL('../MobileTicketPage.tsx', import.meta.url), 'utf8')
const homePage = readFileSync(new URL('../home/MobileHome.tsx', import.meta.url), 'utf8')
const runPage = readFileSync(new URL('../MobileInspectionRunPage.tsx', import.meta.url), 'utf8')
const startPage = readFileSync(new URL('../MobileInspectionStartPage.tsx', import.meta.url), 'utf8')
const todayPage = readFileSync(new URL('../MobileInspectionTodayPage.tsx', import.meta.url), 'utf8')
const onlineOnly = readFileSync(new URL('./onlineOnlyMessage.ts', import.meta.url), 'utf8')
const router = readFileSync(new URL('../../router.tsx', import.meta.url), 'utf8')

describe('physical iPhone offline claim guard', () => {
  it('keeps claim online-only with a Russian local refusal', () => {
    expect(onlineOnly).toContain("ONLINE_ONLY_ACTION_MESSAGE = 'Для этого действия нужен интернет.'")
    expect(ticketPage).toMatch(/if \(!getOnlineStatus\(\)\)[\s\S]*ONLINE_ONLY_ACTION_MESSAGE/)
    expect(homePage).toMatch(/if \(!isOnline && ticket\.status === 'NEW'\)[\s\S]*ONLINE_ONLY_ACTION_MESSAGE/)
  })

  it('guards request assignment offline on detail', () => {
    expect(ticketPage).toMatch(/function handleAssignmentRequest\(\)[\s\S]*ONLINE_ONLY_ACTION_MESSAGE[\s\S]*assignmentRequestM\.mutate\(\)/)
  })

  it('guards round completion offline', () => {
    expect(runPage).toMatch(/async function completeRun\(\)[\s\S]*!offline\.online[\s\S]*ONLINE_ONLY_ACTION_MESSAGE/)
  })

  it('uses the same online-only message for round start', () => {
    expect(startPage).toMatch(/!offline\.online[\s\S]*ONLINE_ONLY_ACTION_MESSAGE/)
    expect(todayPage).toMatch(/!offline\.online[\s\S]*ONLINE_ONLY_ACTION_MESSAGE/)
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
