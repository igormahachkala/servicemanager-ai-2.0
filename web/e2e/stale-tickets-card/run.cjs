// «Заявки старше 10 дней»: живой бэкенд и база, компьютер и телефон, без перезагрузок.
// Запуск: node run.cjs <playwright-core> <stale1Id> <stale2Id> <stale3Id>  (id печатает seed.cjs)
const pw = require(process.argv[2])
const [S1, S2, S3] = process.argv.slice(3)
const API = process.env.STALE_API || 'http://localhost:3399', WEB = process.env.STALE_WEB || 'http://localhost:5398'
const SHOTS = process.env.STALE_SHOTS || require('node:os').tmpdir() + '/'
const TAG = process.env.TAG || 'stale'
const results = []; const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`) }
const j = async (path, token, opts = {}) => { const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } }); return { status: r.status, body: await r.json().catch(() => null) } }
async function login(email) { const r = await j('/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password: 'Passw0rd!' }) }); const tok = r.body.access_token; const me = await j('/auth/me', tok); return { tok, me: me.body } }
async function session(browser, who, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ru-RU' })
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  const staleRequests = []; page.on('response', (r) => { if (/\/tickets\/board\?.*olderThanDays=10/.test(r.url())) staleRequests.push(r.status()) })
  await page.goto(WEB + '/login')
  await page.evaluate(({ tok, me, api }) => { localStorage.setItem('sm_base_url', api); localStorage.setItem('sm_token', tok); localStorage.setItem('sm_user_role', me.role); localStorage.setItem('sma.mobileGuidedTour.v1.' + me.id, 'skipped') }, { ...who, api: API })
  return { ctx, page, errs, staleRequests }
}
async function waitFor(fn, want, ms = 8000) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn().catch(() => undefined); if (v === want) return { ok: true, v, ms: Date.now() - t0 }; await new Promise((r) => setTimeout(r, 250)) } return { ok: false, v } }
const DASH_CARD = 'a[aria-label="Заявки старше 10 дней: открыть список"]'
const dashValue = (p) => p.locator(DASH_CARD).innerText().then((t) => (t.match(/\n\s*(\d+)\s*\n/) || [])[1])
const MOB_CARD = '.mobileHomeQuickCard--slate'
const mobValue = (p) => p.locator(MOB_CARD + ' .mobileHomeQuickCardSub').innerText().then((t) => (t.match(/^(\d+)/) || [])[1])
const boardIds = (p) => p.locator('a[href*="/tickets/"]').evaluateAll((as) => [...new Set(as.map((a) => (a.getAttribute('href').match(/tickets\/([0-9a-f-]{36})/) || [])[1]).filter(Boolean))].sort())
const mobIds = (p) => p.locator('a[href*="/m/tickets/"]').evaluateAll((as) => [...new Set(as.map((a) => (a.getAttribute('href').match(/tickets\/([0-9a-f-]{36})/) || [])[1]).filter(Boolean))].sort())
;(async () => {
  const admin = await login(`qa-admin-${TAG}@stale.local`)
  const stale = [S1, S2, S3].sort()
  const browser = await pw.chromium.launch()
  const dash = await session(browser, admin, { width: 1280, height: 900 })
  const board = await session(browser, admin, { width: 1280, height: 900 })
  const mob = await session(browser, admin, { width: 390, height: 844 })

  await dash.page.goto(WEB + '/dashboard')
  let w = await waitFor(() => dashValue(dash.page), '3'); check('компьютер /dashboard: карточка показывает 3', w.ok, `значение ${w.v}`)
  await dash.page.screenshot({ path: SHOTS + 'stale-dashboard.png' })

  await board.page.goto(WEB + '/dashboard')
  await board.page.locator(DASH_CARD).waitFor()
  await board.page.locator(DASH_CARD).click()
  await board.page.waitForURL(/\/board\?.*olderThanDays=10/)
  check('нажатие на карточку ведёт на /board?olderThanDays=10', /olderThanDays=10/.test(board.page.url()), board.page.url().replace(WEB, ''))
  w = await waitFor(() => board.page.locator('[data-testid="board-stale-filter"]').innerText().then((t) => t.replace(/\s+/g, ' ').trim()), 'Старше 10 дней: 3 ✕')
  check('на доске чип «Старше 10 дней: 3»', w.ok, w.v)
  w = await waitFor(() => boardIds(board.page).then((ids) => ids.join(',')), stale.join(','))
  check('доска показывает ровно три старые заявки', w.ok, w.v)
  const boardText = await board.page.locator('body').innerText()
  check('на доске нет свежей, выполненной и чужой', !/Мигает вывеска|Старая выполненная|Чужая старая/.test(boardText))
  await board.page.screenshot({ path: SHOTS + 'stale-board.png' })

  await mob.page.goto(WEB + '/m')
  w = await waitFor(() => mobValue(mob.page), '3'); check('телефон /m: карточка «3 незакрытых»', w.ok, `значение ${w.v}`)
  check('телефон: счёт пришёл с сервера (board?olderThanDays=10, 200)', mob.staleRequests.includes(200), mob.staleRequests.join(','))
  const title = await mob.page.locator(MOB_CARD + ' .mobileHomeQuickCardTitle').innerText().catch(() => '')
  check('заголовок карточки на телефоне', title === 'Заявки старше 10 дней', title)
  await mob.page.locator(MOB_CARD).click()
  w = await waitFor(() => mobIds(mob.page).then((ids) => ids.join(',')), stale.join(','))
  check('телефон: по нажатию список ровно из трёх старых', w.ok, w.v)
  check('телефон: карточка подсвечена как активный фильтр', await mob.page.locator('.mobileHomeQuickCard--slateActive').count() === 1)
  await mob.page.screenshot({ path: SHOTS + 'stale-mobile.png', fullPage: true })

  await mob.page.locator('a[href*="/m/tickets/"]').first().click()
  await mob.page.waitForURL(/\/m\/tickets\//)
  await mob.page.waitForTimeout(800)
  await mob.page.goBack()
  w = await waitFor(() => mob.page.locator('.mobileHomeQuickCard--slateActive').count(), 1)
  check('телефон: возврат из карточки заявки сохраняет фильтр', w.ok)
  w = await waitFor(() => mobIds(mob.page).then((ids) => ids.join(',')), stale.join(','))
  check('телефон: после возврата тот же список из трёх', w.ok, w.v)

  const mobStaleBefore = mob.staleRequests.length
  // Клиент принимает работу по заявке 3 (на приёмке): она закрывается и должна уйти из счёта.
  const accept = await j(`/tickets/${S3}/acceptance`, admin.tok, { method: 'POST', body: JSON.stringify({ decision: 'ACCEPT', comment: 'Принято' }) })
  check('заявка 3 принята клиентом через API', accept.status === 200 || accept.status === 201, String(accept.status) + ' ' + JSON.stringify(accept.body).slice(0, 120))
  const left = [S1, S2].sort().join(',')
  w = await waitFor(() => dashValue(dash.page), '2'); check('компьютер /dashboard: 3 → 2 без перезагрузки', w.ok, `${w.v}, ${w.ms ?? '-'} мс`)
  w = await waitFor(() => board.page.locator('[data-testid="board-stale-filter"]').innerText().then((t) => t.replace(/\s+/g, ' ').trim()), 'Старше 10 дней: 2 ✕')
  check('доска: чип 3 → 2 без перезагрузки', w.ok, w.v)
  w = await waitFor(() => boardIds(board.page).then((ids) => ids.join(',')), left); check('доска: принятая ушла из списка', w.ok, w.v)
  w = await waitFor(() => mobValue(mob.page), '2'); check('телефон: карточка 3 → 2 без перезагрузки', w.ok, `${w.v}, ${w.ms ?? '-'} мс`)
  w = await waitFor(() => mobIds(mob.page).then((ids) => ids.join(',')), left); check('телефон: принятая ушла из списка', w.ok, w.v)
  check('телефон: после события заявки счёт перезапрошен с сервера', mob.staleRequests.length > mobStaleBefore, String(mob.staleRequests.length))

  await mob.page.locator(MOB_CARD).click()
  w = await waitFor(() => mobIds(mob.page).then((ids) => ids.length > 2), true); check('телефон: повторное нажатие снимает фильтр', w.ok)

  await board.page.locator('[aria-label="Убрать фильтр по возрасту"]').click()
  await board.page.waitForTimeout(1500)
  check('доска: ✕ убирает olderThanDays из адреса', !/olderThanDays/.test(board.page.url()), board.page.url().replace(WEB, ''))
  // Без фильтра на доске снова свежая заявка и принятая (DONE моложе недели): больше двух.
  w = await waitFor(() => boardIds(board.page).then((ids) => ids.length >= 4), true)
  check('доска без фильтра снова показывает и свежие заявки', w.ok)

  for (const [n, s] of [['dashboard', dash], ['board', board], ['mobile', mob]]) check(`ошибок страницы нет: ${n}`, s.errs.length === 0, s.errs.join(' | '))
  await browser.close()
  console.log(results.join('\n'))
  const fails = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${results.length - fails} PASS / ${fails} FAIL`)
  process.exit(fails ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
