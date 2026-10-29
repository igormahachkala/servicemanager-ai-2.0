// 💬 непрочитанного чата: живой бэкенд и база, компьютер и телефон, без перезагрузок.
// Запуск: node run.cjs <playwright-core> <ticket1Id> <ticket2Id>  (id печатает seed.cjs)
const pw = require(process.argv[2])
const [T1, T2] = process.argv.slice(3)
const API = process.env.CHAT_API || 'http://localhost:3399', WEB = process.env.CHAT_WEB || 'http://localhost:5398'
const SHOTS = process.env.CHAT_SHOTS || require('node:os').tmpdir() + '/'
const TAG = process.env.TAG || 'chat'
const BADGE = '[aria-label="Есть непрочитанные сообщения"]'
const results = []; const check = (n, ok, x = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`) }
const j = async (path, token, opts = {}) => { const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } }); return { status: r.status, body: await r.json().catch(() => null) } }
async function login(email) { const r = await j('/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password: 'Passw0rd!' }) }); const tok = r.body.access_token; const me = await j('/auth/me', tok); return { tok, me: me.body } }
async function session(browser, who, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ru-RU' })
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  const reads = []; page.on('request', (r) => { if (r.method() === 'POST' && /\/timeline\/tickets\/.*\/read/.test(r.url())) reads.push(r.url()) })
  await page.goto(WEB + '/login')
  await page.evaluate(({ tok, me, api }) => { localStorage.setItem('sm_base_url', api); localStorage.setItem('sm_token', tok); localStorage.setItem('sm_user_role', me.role); localStorage.setItem('sma.mobileGuidedTour.v1.' + me.id, 'skipped') }, { ...who, api: API })
  return { ctx, page, errs, reads }
}
const count = (p) => p.locator(BADGE).count()
async function waitAtLeast(p, n, ms = 6000) { const t0 = Date.now(); let c; while (Date.now() - t0 < ms) { c = await count(p); if (c >= n) return { ok: true, c, ms: Date.now() - t0 }; await p.waitForTimeout(250) } return { ok: false, c } }
async function waitCount(p, n, ms = 6000) { const t0 = Date.now(); let c; while (Date.now() - t0 < ms) { c = await count(p); if (c === n) return { ok: true, c, ms: Date.now() - t0 }; await p.waitForTimeout(250) } return { ok: false, c } }
const comment = (tok, id, text) => j(`/tickets/${id}/comments`, tok, { method: 'POST', body: JSON.stringify({ comment: text }) })
;(async () => {
  const admin = await login(`qa-admin-${TAG}@chat.local`), client = await login(`qa-client-${TAG}@chat.local`)
  for (const who of [client, admin]) for (const id of [T1, T2]) await j('/timeline/tickets/' + id + '/read', who.tok, { method: 'POST', body: '{}' })
  const browser = await pw.chromium.launch()
  const mob = await session(browser, admin, { width: 390, height: 844 })
  const desk = await session(browser, admin, { width: 1280, height: 800 })
  const adm = await session(browser, client, { width: 390, height: 844 })
  await mob.page.goto(WEB + '/m'); await desk.page.goto(WEB + '/board'); await adm.page.goto(WEB + '/m')
  await Promise.all([mob, desk, adm].map((s) => s.page.waitForTimeout(2500)))
  check('исходно 💬 нет: телефон читателя', (await count(mob.page)) === 0)
  check('исходно 💬 нет: компьютер читателя', (await count(desk.page)) === 0)

  const c1 = await comment(client.tok, T1, 'Мастер будет в 15:00')
  check('клиент отправил сообщение в заявку 1', c1.status === 201, String(c1.status))
  let w = await waitCount(mob.page, 1); check('телефон читателя: 💬 появился без перезагрузки', w.ok, `${w.c} шт, ${w.ms ?? '-'} мс`)
  w = await waitCount(desk.page, 1); check('компьютер читателя: 💬 появился без перезагрузки', w.ok, `${w.c} шт, ${w.ms ?? '-'} мс`)
  await adm.page.waitForTimeout(1500); check('автор сообщения 💬 у себя не видит', (await count(adm.page)) === 0)
  const deskCard = desk.page.locator('.ticket', { has: desk.page.locator(BADGE) })
  check('компьютер: значок на карточке заявки 1', (await deskCard.locator(`a[href*="${T1}"]`).count()) > 0)
  await mob.page.screenshot({ path: SHOTS + 'm-home-unread.png' }); await desk.page.screenshot({ path: SHOTS + 'd-board-unread.png' })

  // Телефон: открыть заявку на вкладке «Чат», вернуться.
  const mobCard = mob.page.locator(`a[href*="/m/tickets/${T1}"]`).first()
  await mobCard.click(); await mob.page.waitForTimeout(1200)
  const chatTab = mob.page.locator('.mobileDetailTab', { hasText: 'Чат' }).first()
  if (await chatTab.count()) await chatTab.click()
  await mob.page.waitForTimeout(1500)
  await mob.page.screenshot({ path: SHOTS + 'm-ticket-chat.png' })
  check('телефон: отметка прочтения отправлена из чата', mob.reads.length >= 1, String(mob.reads.length))
  await mob.page.goBack()
  w = await waitCount(mob.page, 0); check('телефон: после прочтения 💬 исчез в списке', w.ok, `${w.c} шт`)
  w = await waitCount(desk.page, 0); check('компьютер того же пользователя: 💬 исчез сам (chat.read)', w.ok, `${w.c} шт, ${w.ms ?? '-'} мс`)

  // Раздел «Чаты» на телефоне.
  await mob.page.goto(WEB + '/m/chats'); await mob.page.waitForTimeout(2000)
  const c2 = await comment(client.tok, T2, 'Нужен доступ в щитовую')
  w = await waitCount(mob.page, 1); check('«Чаты»: 💬 на свёрнутой строке объекта без перезагрузки', w.ok, `${w.c} шт`)
  await mob.page.locator('.mobileChatsSection[aria-label="Заявки"] button').first().click(); await mob.page.waitForTimeout(600)
  check('«Чаты»: 💬 на строке заявки 2 в разделе «Заявки»', (await mob.page.locator(`a[href*="${T2}"] ${BADGE}`).count()) === 1)
  await mob.page.screenshot({ path: SHOTS + 'm-chats-expanded.png' })
  await mob.page.screenshot({ path: SHOTS + 'm-chats-unread.png' })
  w = await waitCount(desk.page, 1); check('компьютер: 💬 у заявки 2', w.ok, `${w.c} шт`)

  // Компьютер: карточка заявки сама прокручивает к последнему сообщению чата;
  // отметка уходит, только когда блок чата в окне.
  const readsBefore = desk.reads.length
  await desk.page.locator(`a[href*="${T2}"]`).first().click()
  await desk.page.waitForTimeout(2500)
  const chatVisible = await desk.page.evaluate(() => { const el = [...document.querySelectorAll('h3,h2')].find((h) => /Чат заявки/.test(h.textContent || '')); if (!el) return null; const r = el.closest('.panel').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 })
  const readsOnOpen = desk.reads.length - readsBefore
  check('компьютер: отметка, когда блок чата в окне (карточка сама прокручивает к последнему сообщению)', chatVisible === null ? false : (chatVisible ? readsOnOpen >= 1 : readsOnOpen === 0), `чат в окне=${chatVisible}, отметок=${readsOnOpen}`)
  await desk.page.evaluate(() => { const el = [...document.querySelectorAll('h3,h2')].find((h) => /Чат заявки/.test(h.textContent || '')); el && el.scrollIntoView({ block: 'center' }) })
  await desk.page.waitForTimeout(1500)
  await desk.page.screenshot({ path: SHOTS + 'd-ticket-chat.png' })
  check('компьютер: после прокрутки к чату отметка отправлена', desk.reads.length - readsBefore >= 1, String(desk.reads.length - readsBefore))
  await desk.page.goBack()
  w = await waitCount(desk.page, 0); check('компьютер: 💬 исчез после прочтения', w.ok, `${w.c} шт`)
  w = await waitCount(mob.page, 0); check('телефон: 💬 исчез после прочтения на компьютере', w.ok, `${w.c} шт`)

  // Скрытая вкладка не читает.
  await desk.page.locator(`a[href*="${T2}"]`).first().click(); await desk.page.waitForTimeout(1500)
  await desk.page.evaluate(() => { const el = [...document.querySelectorAll('h3,h2')].find((h) => /Чат заявки/.test(h.textContent || '')); el && el.scrollIntoView({ block: 'center' }) })
  await desk.page.waitForTimeout(800)
  await desk.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  const r0 = desk.reads.length
  await comment(client.tok, T2, 'Ещё вопрос')
  await desk.page.waitForTimeout(3000)
  check('скрытая вкладка: новое сообщение не отмечено прочитанным', desk.reads.length === r0, `${desk.reads.length - r0}`)
  w = await waitAtLeast(mob.page, 1); check('телефон: 💬 горит, пока вкладка компьютера скрыта', w.ok, `${w.c} шт`)
  await desk.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await desk.page.waitForTimeout(1500)
  check('вкладка снова видна: отметка отправлена', desk.reads.length > r0, `${desk.reads.length - r0}`)
  w = await waitCount(mob.page, 0); check('телефон: 💬 исчез после возврата во вкладку', w.ok, `${w.c} шт`)

  for (const [n, s] of [['телефон', mob], ['компьютер', desk], ['телефон автора', adm]]) check(`${n}: ошибок страницы нет`, s.errs.length === 0, s.errs.join(' | '))
  await browser.close()
  console.log(results.join('\n')); const f = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\nИТОГО: ${results.length - f} PASS / ${f} FAIL`); process.exit(f ? 1 : 0)
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(2) })
