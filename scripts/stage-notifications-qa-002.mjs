#!/usr/bin/env node
/**
 * SMA-STAGE-NOTIFICATIONS-QA-002 — runtime QA (API + Playwright screenshots)
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_API = 'http://194.67.101.37:3001'
const BASE_WEB = 'http://194.67.101.37:4174'
const OUT = join(process.cwd(), 'docs/qa-screenshots/SMA-STAGE-NOTIFICATIONS-QA-002')
const CLIENT_CO = '10000000-0000-4000-8000-000000000001'
const LOC_OTHER = '30000000-0000-4000-8000-000000000002'
const CAT = '40000000-0000-4000-8000-000000000001'
const TECH_SCOPE = `?linkedClientCompanyId=${CLIENT_CO}`
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function api(method, path, { token, body, multipart, query = '' } = {}) {
  const headers = { Origin: BASE_WEB }
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (multipart) {
    payload = multipart.body
    headers['Content-Type'] = multipart.contentType
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(BASE_API + path + query, { method, headers, body: payload })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 500) }
  }
  return { status: res.status, json }
}

async function login(email) {
  for (let i = 0; i < 12; i++) {
    const { status, json } = await api('POST', '/auth/login', { body: { email, password: 'Test123!' } })
    if (status === 201) return json.access_token
    if (status !== 429) throw new Error(`login ${email}: ${status} ${JSON.stringify(json)}`)
    await sleep((json.retryAfterSeconds || 22) * 1000 + 1000)
  }
  throw new Error(`login rate limited: ${email}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function ticketFrom(resp) {
  const t = resp.ticket || resp
  return { id: t.id, ticketNumber: t.ticketNumber }
}

async function makeMultipart() {
  const boundary = '----QA' + Date.now()
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n`),
    PNG,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

async function prepTicket(clientT, techT, tag) {
  const { status, json } = await api('POST', '/tickets', {
    token: clientT,
    body: {
      locationId: LOC_OTHER,
      problemCategoryId: CAT,
      description: `NOTIF-QA-002 ${tag}`,
      comment: 'created',
    },
  })
  if (status >= 400) throw new Error(`create ${status}`)
  const { id, ticketNumber } = ticketFrom(json)
  await api('POST', `/tickets/${id}/claim`, { token: techT, query: TECH_SCOPE })
  await api('PATCH', `/tickets/${id}/status`, {
    token: techT,
    query: TECH_SCOPE,
    body: { status: 'IN_PROGRESS', comment: `start ${tag}` },
  })
  const mp = await makeMultipart()
  await api('POST', `/tickets/${id}/attachments`, { token: techT, query: TECH_SCOPE, multipart: mp })
  await api('POST', `/tickets/${id}/comments`, {
    token: techT,
    query: TECH_SCOPE,
    body: { comment: `report ${tag}` },
  })
  const toAcc = await api('PATCH', `/tickets/${id}/status`, {
    token: techT,
    query: TECH_SCOPE,
    body: { status: 'AWAITING_ACCEPTANCE', comment: `ready ${tag}` },
  })
  if (toAcc.status >= 400) throw new Error(`to acceptance ${toAcc.status}`)
  return { id, ticketNumber }
}

async function fetchNotifs(token, query = '') {
  const { status, json } = await api('GET', '/notifications', { token, query })
  return { status, unreadCount: json.unreadCount ?? 0, items: json.items ?? [] }
}

function findNotif(items, type, ticketId) {
  return items.find((n) => n.type === type && n.entityId === ticketId)
}

async function injectToken(page, token) {
  await page.goto(`${BASE_WEB}/login?clear=1`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    localStorage.setItem('sm_token', t)
  }, token)
}

async function screenshot(page, name) {
  const path = join(OUT, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const report = { scenarios: {}, ui: {}, verdict: 'PASS' }

  const clientT = await login('client@test.local')
  const techT = await login('tech@test.local')

  // Baseline unread
  const baseClient = await fetchNotifs(clientT)
  const baseTech = await fetchNotifs(techT, TECH_SCOPE)

  // S1 awaiting acceptance -> client
  const s1 = await prepTicket(clientT, techT, 'N1-await')
  await sleep(1500)
  const n1 = await fetchNotifs(clientT)
  const hit1 = findNotif(n1.items, 'ticket.awaiting_acceptance', s1.id)
  report.scenarios.awaiting_acceptance = {
    ticket: s1.ticketNumber,
    recipient: 'client@test.local',
    created: !!hit1,
    unreadIncreased: n1.unreadCount >= baseClient.unreadCount + (hit1 && !hit1.readAt ? 1 : 0),
    item: hit1
      ? { type: hit1.type, title: hit1.title, message: hit1.message, entityId: hit1.entityId, readAt: hit1.readAt }
      : null,
    listContains: !!hit1,
    navigable: hit1?.entityType === 'Ticket' && !!hit1?.entityId,
  }

  // S2 accept -> tech
  const s2 = await prepTicket(clientT, techT, 'N2-accept')
  await api('POST', `/tickets/${s2.id}/acceptance`, { token: clientT, body: { decision: 'ACCEPT' } })
  await sleep(1500)
  const n2 = await fetchNotifs(techT, TECH_SCOPE)
  const hit2 = findNotif(n2.items, 'ticket.accepted', s2.id)
  report.scenarios.accepted = {
    ticket: s2.ticketNumber,
    recipient: 'tech@test.local',
    created: !!hit2,
    item: hit2
      ? { type: hit2.type, title: hit2.title, message: hit2.message, entityId: hit2.entityId, linkedClientCompanyId: hit2.linkedClientCompanyId }
      : null,
    listContains: !!hit2,
    navigable: hit2?.entityType === 'Ticket' && !!hit2?.entityId,
  }

  // S3 reject -> tech
  const s3 = await prepTicket(clientT, techT, 'N3-reject')
  const rejComment = 'NOTIF-QA: брак работ, переделать'
  await api('POST', `/tickets/${s3.id}/acceptance`, {
    token: clientT,
    body: { decision: 'REJECT', comment: rejComment },
  })
  await sleep(1500)
  const n3 = await fetchNotifs(techT, TECH_SCOPE)
  const hit3 = findNotif(n3.items, 'ticket.rejected', s3.id)
  report.scenarios.rejected = {
    ticket: s3.ticketNumber,
    recipient: 'tech@test.local',
    created: !!hit3,
    item: hit3
      ? { type: hit3.type, title: hit3.title, message: hit3.message, entityId: hit3.entityId }
      : null,
    commentInMessage: hit3?.message?.includes(rejComment) ?? false,
    listContains: !!hit3,
    navigable: hit3?.entityType === 'Ticket' && !!hit3?.entityId,
  }

  for (const key of ['awaiting_acceptance', 'accepted', 'rejected']) {
    const s = report.scenarios[key]
    if (!s?.created || !s?.listContains || !s?.navigable) report.verdict = 'FAIL'
    if (key === 'rejected' && !s?.commentInMessage) report.verdict = 'FAIL'
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  try {
    // Mobile client notifications list
    await injectToken(page, clientT)
    await page.goto(`${BASE_WEB}/m/notifications`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)
    report.ui.mobile_client_list = await screenshot(page, '01-mobile-client-notifications-list')

    // Click awaiting acceptance notif if visible
    const awaitingBtn = page.locator('button.mobileNotificationBtn').filter({ hasText: 'ожидает приёмки' }).first()
    if (await awaitingBtn.count()) {
      await awaitingBtn.click()
      await page.waitForURL(/\/m\/tickets\//, { timeout: 15000 })
      report.ui.mobile_client_nav_ticket = await screenshot(page, '02-mobile-client-ticket-from-notif')
      report.ui.mobile_client_nav_ok = true
    } else {
      report.ui.mobile_client_nav_ok = false
    }

    // Mobile tech notifications
    await injectToken(page, techT)
    await page.goto(`${BASE_WEB}/m/notifications${TECH_SCOPE}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(2000)
    report.ui.mobile_tech_list = await screenshot(page, '03-mobile-tech-notifications-list')

    const acceptBtn = page.locator('button.mobileNotificationBtn').filter({ hasText: 'Работа принята' }).first()
    if (await acceptBtn.count()) {
      await acceptBtn.click()
      await page.waitForURL(/\/m\/tickets\//, { timeout: 15000 })
      report.ui.mobile_tech_nav_accept = await screenshot(page, '04-mobile-tech-ticket-accepted-notif')
    }

    // Desktop client - /notifications route (SPA fallback)
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const dpage = await desktop.newPage()
    await injectToken(dpage, clientT)
    await dpage.goto(`${BASE_WEB}/notifications`, { waitUntil: 'networkidle', timeout: 60000 })
    await dpage.waitForTimeout(2000)
    report.ui.desktop_notifications_route = await screenshot(dpage, '05-desktop-notifications-route')

    await dpage.goto(`${BASE_WEB}/board`, { waitUntil: 'networkidle', timeout: 60000 })
    await dpage.waitForTimeout(1500)
    report.ui.desktop_board = await screenshot(dpage, '06-desktop-board-client')
    report.ui.desktop_has_notifications_page = (await dpage.locator('h1:has-text("Уведомления")').count()) > 0

    // Mobile shell badge
    await injectToken(page, clientT)
    await page.goto(`${BASE_WEB}/m`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    report.ui.mobile_home_badge = await screenshot(page, '07-mobile-home-topbar')
    report.ui.mobile_badge_dot = (await page.locator('.mobileNavBadgeDot, .mobileTopBarAction .mobileNavBadgeDot').count()) > 0

    if (!report.ui.mobile_client_nav_ok) report.verdict = 'FAIL'
  } catch (e) {
    report.ui.error = String(e)
    report.verdict = 'FAIL'
  } finally {
    await browser.close()
  }

  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
