// TUX-01…04: браузерная проверка навигации заявок. Playwright + vite dev + моки API.
// Запуск: node run.cjs <playwright-core> [фильтр-по-имени-сценария]
const pw = require(process.argv[2]); const { installMocks } = require('./mock.cjs')
const ONLY = process.argv[3] || ''
const BASE = process.env.TNAV_BASE || 'http://localhost:5398'
const results = []
let current = ''
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  [${current}] ${name}${extra !== '' ? '  — ' + extra : ''}`)
const settle = (p, ms = 900) => p.waitForTimeout(ms)
const histLen = (p) => p.evaluate(() => history.length)
const SCROLLER = `(() => { for (const s of ['main.contentMain', '#root']) { const m = document.querySelector(s); if (m && m.scrollHeight > m.clientHeight && /auto|scroll/.test(getComputedStyle(m).overflowY)) return m } return document.scrollingElement })()`
const scrollY = (p) => p.evaluate(`Math.round(${SCROLLER}.scrollTop)`)
const scrollTo = (p, y) => p.evaluate(`${SCROLLER}.scrollTop = ${y}`)
const caption = (p) => p.locator('[data-testid="ticket-origin"]').first().innerText({ timeout: 1500 }).catch(() => '')
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search }

const ME = {
  client: { id: 'u1', email: 'a@test.local', role: 'ADMIN', companyId: 'client-1', canAccessManagementSurface: true },
  provider: { id: 'u1', email: 'd@test.local', role: 'DISPATCHER', companyId: 'prov-1', canAccessManagementSurface: true },
  platform: { id: 'u1', email: 'p@test.local', role: 'PLATFORM_ADMIN', companyId: 'platform-0', canAccessManagementSurface: true },
}
const COMPANY = { client: 'CLIENT', provider: 'PROVIDER', platform: 'PLATFORM' }

async function session(browser, who, { viewport, delayMs = 0, delayPaths, max = false } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 800 }, locale: 'ru-RU' })
  if (max) {
    await ctx.addInitScript(() => {
      window.WebApp = { initData: 'user=1', initDataUnsafe: { user: { id: 1 } }, platform: 'web', version: '1', ready() {}, expand() {}, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } }
    })
  }
  const me = ME[who]; const log = []
  await installMocks(ctx, { me, company: { id: me.companyId, name: 'Компания', type: COMPANY[who] }, ticketOwner: 'client-1', delayMs, delayPaths, log })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await page.goto(BASE + '/')
  await page.evaluate((r) => { localStorage.setItem('sm_base_url', 'http://mock.api'); localStorage.setItem('sm_token', 'x.eyJzdWIiOiJ1MSJ9.y'); localStorage.setItem('sm_user_role', r); localStorage.setItem('sma.mobileGuidedTour.v1.u1', 'skipped') }, me.role)
  return { ctx, page, log, errs }
}

/**
 * Открыть элемент списка из середины: прокрутить его к центру (это и есть
 * «позиция прокрутки», которую надо вернуть), запомнить, кликнуть.
 */
async function clickVisible(page, selector, _minTop, frac = 0.6) {
  const count = await page.locator(selector).count()
  if (!count) throw new Error(`нет элементов ${selector}`)
  const idx = Math.min(count - 1, Math.floor(count * frac))
  const loc = page.locator(selector).nth(idx)
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await settle(page, 400)
  const y = await scrollY(page)
  const href = (await loc.getAttribute('href')) || ''
  const top = Math.round((await loc.boundingBox()).y)
  await loc.click()
  return { idx, href, top, loc, y }
}

function scopeOfTicketRequests(log, ticketId) {
  return log.filter((l) => l.startsWith(`GET /tickets/${ticketId}`) && !l.includes('/timeline'))
}

async function scenario(name, fn) {
  if (ONLY && !name.includes(ONLY)) return
  current = name
  try { await fn() } catch (e) { check('сценарий выполнен без исключения', false, String(e).split('\n')[0].slice(0, 200)) }
}

;(async () => {
  const browser = await pw.chromium.launch()

  // ---------------- DESKTOP ----------------
  await scenario('desktop Board', async () => {
    const { ctx, page, errs, log } = await session(browser, 'client', { delayMs: 600, delayPaths: /board|analytics/ })
    await page.goto(BASE + '/board?linkedClientCompanyId=client-1'); await settle(page, 2000)
    const objectSel = page.locator('label', { hasText: 'Объект' }).locator('select').first()
    const archive = page.locator('label', { hasText: 'Архив' }).locator('input[type=checkbox]').first()
    await objectSel.selectOption('loc-1'); await archive.check(); await settle(page, 1500)
    const len0 = await histLen(page)
    const { href, top, y: y0 } = await clickVisible(page, 'a[href^="/tickets/t-"]', 120); await settle(page, 1500)
    check('открыта карточка', path(page) === href, path(page))
    check('подпись «Заявки»', (await caption(page)) === 'Открыто из раздела «Заявки»', await caption(page))
    check('нет технического бейджа (companyId/linkedClientCompanyId/«Контекст доступа»)', !/linkedClientCompanyId:|companyId:|Контекст доступа/.test(await page.locator('body').innerText()))
    const anchor = page.locator(`a[href="${href}"]`).first()
    await page.getByRole('button', { name: '← Назад: Заявки' }).first().click(); await settle(page, 2200)
    check('«Назад»: исходный URL', path(page) === '/board?linkedClientCompanyId=client-1', path(page))
    check('«Назад»: шаг по истории (history.length не вырос)', (await histLen(page)) === len0 + 1, `${await histLen(page)} vs ${len0 + 1}`)
    check('«Назад»: фильтры объект+архив после асинхронной загрузки (600 мс)', (await objectSel.inputValue()) === 'loc-1' && (await archive.isChecked()))
    check('«Назад»: прокрутка', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
    check('«Назад»: открытая строка на том же месте (±24px)', Math.abs(Math.round((await anchor.boundingBox()).y) - top) <= 24, `${Math.round((await anchor.boundingBox()).y)} vs ${top}`)
    await page.goForward(); await settle(page, 1500)
    check('Forward: карточка с подписью', path(page) === href && (await caption(page)) !== '')
    await page.goBack(); await settle(page, 2200)
    check('Back: фильтры и строка на месте', (await objectSel.inputValue()) === 'loc-1' && (await archive.isChecked()) && Math.abs(Math.round((await anchor.boundingBox()).y) - top) <= 24)
    check('API доски получил контур клиента', log.some((l) => l.startsWith('GET /tickets/board') && l.includes('linkedClientCompanyId=client-1')))
    check('API доски получил фильтр объекта', log.some((l) => l.startsWith('GET /tickets/board') && l.includes('locationId=loc-1')))
    // запись источника недоступна по истории → переход на returnTo + снимок
    await page.goForward(); await settle(page, 1200)
    await page.evaluate(() => history.replaceState({ ...history.state, idx: 0 }, '')); await page.reload(); await settle(page, 1500)
    await page.getByRole('button', { name: '← Назад: Заявки' }).first().click(); await settle(page, 2200)
    check('fallback: returnTo и фильтры из снимка', path(page) === '/board?linkedClientCompanyId=client-1' && (await objectSel.inputValue()) === 'loc-1')
    check('ошибок страницы нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('desktop Board provider', async () => {
    const { ctx, page, errs, log } = await session(browser, 'provider')
    await page.goto(BASE + '/board?linkedClientCompanyId=client-1'); await settle(page, 2000)
    const { href } = await clickVisible(page, 'a[href^="/tickets/t-"]', 120); await settle(page, 1500)
    check('ссылка несёт linkedClientCompanyId клиента', href.includes('linkedClientCompanyId=client-1'), href)
    const id = href.split('?')[0].split('/').pop()
    const reqs = scopeOfTicketRequests(log, id)
    check('GET /tickets/:id с linkedClientCompanyId=client-1, без companyId', reqs.length > 0 && reqs.every((r) => r.includes('linkedClientCompanyId=client-1') && !r.includes('companyId=client-1&') && !/[?&]companyId=/.test(r)), reqs.join(' '))
    check('подпись «Заявки», режим «Заявка клиента»', (await caption(page)) === 'Открыто из раздела «Заявки»' && /Заявка клиента/.test(await page.locator('body').innerText()))
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  for (const [name, url] of [
    ['desktop Rounds run', '/inspection/runs/run-1'],
    ['desktop Rounds run from location card (?companyId)', '/inspection/runs/run-1?companyId=client-1'],
    ['desktop Rounds quick', '/inspection/quick/run-1'],
    ['desktop Rounds report', '/inspection/runs/run-1/report'],
  ]) {
    await scenario(name, async () => {
      const { ctx, page, errs, log } = await session(browser, 'provider', { delayMs: 500, delayPaths: /inspection/ })
      await page.goto(BASE + url); await settle(page, 2200)
      const links = await page.locator('a[href^="/tickets/t-"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
      check('есть ссылки на заявки', links.length > 0, String(links.length))
      check('все ссылки несут linkedClientCompanyId=client-1 и не несут companyId', links.length > 0 && links.every((h) => h.includes('linkedClientCompanyId=client-1') && !/[?&]companyId=/.test(h)), links[0])
      const len0 = await histLen(page)
      const { href, y: y0 } = await clickVisible(page, 'a[href^="/tickets/t-"]', 100); await settle(page, 1500)
      const id = href.split('?')[0].split('/').pop()
      const reqs = scopeOfTicketRequests(log, id)
      check('API заявки получил контур владельца, 404 нет', reqs.length > 0 && reqs.every((r) => r.includes('linkedClientCompanyId=client-1')) && !/не найден|not found/i.test(await page.locator('body').innerText()), reqs.join(' '))
      check('подпись «Обходы»', (await caption(page)) === 'Открыто из раздела «Обходы»', await caption(page))
      await page.getByRole('button', { name: '← Назад: Обходы' }).first().click(); await settle(page, 2000)
      check('«Назад»: тот же обход и тот же URL', path(page) === url, path(page))
      check('«Назад»: шаг по истории', (await histLen(page)) === len0 + 1)
      check('«Назад»: прокрутка после асинхронной загрузки', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
      check('ошибок нет', errs.length === 0, errs.join(' | '))
      await ctx.close()
    })
  }

  await scenario('desktop Rounds PLATFORM_ADMIN observer', async () => {
    const { ctx, page, log } = await session(browser, 'platform')
    await page.goto(BASE + '/inspection/runs/run-1?companyId=client-1'); await settle(page, 2000)
    const links = await page.locator('a[href^="/tickets/t-"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    check('ссылки несут companyId=client-1 (режим наблюдения), не linked', links.length > 0 && links.every((h) => /[?&]companyId=client-1/.test(h) && !h.includes('linkedClientCompanyId')), links[0])
    await page.locator('a[href^="/tickets/t-"]').first().click(); await settle(page, 1500)
    const id = new URL(page.url()).pathname.split('/').pop()
    check('API заявки получил companyId=client-1', scopeOfTicketRequests(log, id).some((r) => r.includes('companyId=client-1')))
    check('режим «Режим наблюдения» назван словами', /Режим наблюдения/.test(await page.locator('body').innerText()))
    await ctx.close()
  })

  await scenario('desktop direct link + push', async () => {
    const { ctx, page, errs } = await session(browser, 'client')
    await page.goto(BASE + '/tickets/t-7'); await settle(page, 1500)
    check('direct link: без подписи источника', (await page.locator('[data-testid="ticket-origin"]').count()) === 0)
    check('direct link: «← Назад к доске» по умолчанию', (await page.getByRole('button', { name: '← Назад к доске' }).count()) >= 1)
    await page.evaluate(() => history.replaceState({ ...history.state, usr: { ticketNav: { v: 1, source: 'board', returnTo: 'https://evil.example/board', originKey: 'x', originIdx: 0 } } }, ''))
    await page.reload(); await settle(page, 1200)
    const backHref = await page.locator('a:has(button:has-text("Назад"))').first().getAttribute('href')
    check('подделанный внешний returnTo отброшен', (await page.locator('[data-testid="ticket-origin"]').count()) === 0 && !/evil/.test(backHref || ''), backHref)
    await page.goto(BASE + '/board'); await settle(page, 1500)
    const len0 = await histLen(page)
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-navigate', ticketId: 't-3', notificationType: 'ticket.assigned' } })))
    await settle(page, 1500)
    check('push (приложение открыто): переход в карточку', path(page).startsWith('/tickets/t-3'), path(page))
    check('push: без подписи источника, «Назад к доске»', (await page.locator('[data-testid="ticket-origin"]').count()) === 0 && (await page.getByRole('button', { name: '← Назад к доске' }).count()) >= 1)
    await page.goBack(); await settle(page, 1200)
    check('push: браузерный Back на предыдущий экран', path(page) === '/board' && (await histLen(page)) === len0 + 1, path(page))
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  // ---------------- MOBILE ----------------
  const MOB = { width: 390, height: 780 }

  await scenario('mobile Home', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB, delayMs: 600, delayPaths: /board/ })
    await page.goto(BASE + '/m'); await settle(page, 2200)
    await page.locator('button.mobileFilterTab', { hasText: 'Новые' }).click()
    await page.locator('input.mobileHomeSearchBarInput').fill('Электрика'); await settle(page, 600)
    const len0 = await histLen(page)
    const { top, idx, y: y0 } = await clickVisible(page, 'a.mobileCardClickable'); await settle(page, 1300)
    check('подпись «Главная»', (await caption(page)) === 'Открыто из раздела «Главная»', await caption(page))
    await page.goBack(); await settle(page, 2200)
    check('Back: поиск восстановлен', (await page.locator('input.mobileHomeSearchBarInput').inputValue()) === 'Электрика')
    check('Back: вкладка «Новые» активна', /Active/.test((await page.locator('button.mobileFilterTab', { hasText: 'Новые' }).getAttribute('class')) || ''))
    check('Back: прокрутка после асинхронной загрузки (600 мс)', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
    check('Back: та же карточка на том же месте (±24px)', Math.abs(Math.round((await page.locator('a.mobileCardClickable').nth(idx).boundingBox()).y) - top) <= 24)
    await page.goForward(); await settle(page, 1200)
    check('Forward: карточка с подписью', (await caption(page)) === 'Открыто из раздела «Главная»')
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 2200)
    check('«Назад»: шаг по истории', (await histLen(page)) === len0 + 1 && path(page).startsWith('/m'))
    check('«Назад»: поиск и прокрутка', (await page.locator('input.mobileHomeSearchBarInput').inputValue()) === 'Электрика' && Math.abs((await scrollY(page)) - y0) <= 2)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile Acceptance', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB })
    await page.goto(BASE + '/m'); await settle(page, 2000)
    await page.locator('.mobileHomeQuickCard', { hasText: 'На приёмке' }).first().click(); await settle(page, 600)
    await clickVisible(page, 'a.mobileCardClickable', 100); await settle(page, 1300)
    check('подпись «На приёмке»', (await caption(page)) === 'Открыто из раздела «На приёмке»', await caption(page))
    check('aria-label «Назад: На приёмке»', (await page.locator('a.mobileTicketBackBtn').getAttribute('aria-label')) === 'Назад: На приёмке')
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/home-board/.test(k)) localStorage.removeItem(k) })
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 1500)
    check('«Назад»: быстрая карта «На приёмке» активна (из снимка, не из localStorage)', /--active/.test((await page.locator('.mobileHomeQuickCard', { hasText: 'На приёмке' }).first().getAttribute('class')) || ''))
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile My Tickets', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB })
    await page.goto(BASE + '/m/my'); await settle(page, 2000)
    await page.locator('button.mobileFiltersToggleBtn').click(); await settle(page, 400)
    await page.locator('button.mobileFilterChip', { hasText: '7 дней' }).click()
    await page.locator('input.mobileHomeSearchInput').fill('Заявка'); await settle(page, 600)
    await page.locator('button.mobileFiltersToggleBtn').click().catch(() => {}); await settle(page, 400)
    const url0 = path(page)
    const { y: y0 } = await clickVisible(page, 'a.mobileCardClickable', 100); await settle(page, 1300)
    check('подпись «Мои заявки»', (await caption(page)) === 'Открыто из раздела «Мои заявки»', await caption(page))
    await page.goBack(); await settle(page, 1800)
    check('Back: тот же URL (вкладка/поиск в адресе)', path(page) === url0, `${path(page)} vs ${url0}`)
    check('Back: прокрутка', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
    check('Back: поиск в адресе восстановлен', /boardSearch=/.test(path(page)))
    const panelOpen = (await page.locator('input.mobileHomeSearchInput').count()) > 0
    if (!panelOpen) { await page.locator('button.mobileFiltersToggleBtn').click(); await settle(page, 400) }
    check('Back: поиск в поле', (await page.locator('input.mobileHomeSearchInput').inputValue()) === 'Заявка')
    check('Back: фильтр периода «7 дней» восстановлен (вне URL, из снимка)', /Active/.test((await page.locator('button.mobileFilterChip', { hasText: '7 дней' }).getAttribute('class')) || ''))
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile Chats', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB })
    await page.goto(BASE + '/m/chats'); await settle(page, 2000)
    await page.getByText('ЗАЯВКИ', { exact: false }).first().click(); await settle(page, 500)
    const search = page.locator('input').first()
    await search.fill('Заявка 2'); await settle(page, 500)
    const n = await page.locator('a[href*="/m/tickets/"]').count()
    check('в чатах есть заявки после поиска', n > 0, String(n))
    await page.locator('a[href*="/m/tickets/"]').first().click(); await settle(page, 1300)
    check('подпись «Чаты»', (await caption(page)) === 'Открыто из раздела «Чаты»', await caption(page))
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 1500)
    check('«Назад»: /m/chats', path(page) === '/m/chats', path(page))
    check('«Назад»: поиск восстановлен', (await search.inputValue()) === 'Заявка 2', await search.inputValue())
    check('«Назад»: раскрытый список заявок восстановлен', (await page.locator('a[href*="/m/tickets/"]').count()) === n)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile Notifications', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB, delayMs: 700, delayPaths: /notifications/ })
    await page.goto(BASE + '/m/notifications'); await settle(page, 2200)
    const len0 = await histLen(page)
    const { y: y0 } = await clickVisible(page, 'button.mobileNotificationBtn'); await settle(page, 1300)
    check('подпись «Уведомления»', (await caption(page)) === 'Открыто из раздела «Уведомления»', await caption(page))
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 2200)
    check('«Назад»: список, шаг по истории', path(page) === '/m/notifications' && (await histLen(page)) === len0 + 1)
    check('«Назад»: прокрутка после асинхронной загрузки (700 мс)', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile Rounds provider', async () => {
    const { ctx, page, errs, log } = await session(browser, 'provider', { viewport: MOB })
    await page.goto(BASE + '/m/inspection/run-1'); await settle(page, 2200)
    const links = await page.locator('a[href*="/m/tickets/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    check('ссылки на заявки несут linkedClientCompanyId=client-1', links.length > 0 && links.every((h) => h.includes('linkedClientCompanyId=client-1')), links[0])
    const urlAtClick = path(page)
    const { href, y: y0 } = await clickVisible(page, 'a[href*="/m/tickets/"]', 100); await settle(page, 1500)
    const id = href.split('?')[0].split('/').pop()
    check('API заявки получил контур владельца', scopeOfTicketRequests(log, id).some((r) => r.includes('linkedClientCompanyId=client-1')))
    check('подпись «Обходы»', (await caption(page)) === 'Открыто из раздела «Обходы»', await caption(page))
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 1800)
    check('«Назад»: в тот же обход, тот же URL, что при клике (раньше — на главную)', path(page) === urlAtClick && path(page).startsWith('/m/inspection/run-1'), `${path(page)} vs ${urlAtClick}`)
    check('«Назад»: прокрутка', Math.abs((await scrollY(page)) - y0) <= 2, `${await scrollY(page)} vs ${y0}`)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('mobile direct link + push', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB })
    await page.goto(BASE + '/m/tickets/t-3'); await settle(page, 1500)
    check('direct link: без подписи, «Назад» на главную', (await page.locator('[data-testid="ticket-origin"]').count()) === 0 && (await page.locator('a.mobileTicketBackBtn').getAttribute('href')) === '/m/')
    await page.goto(BASE + '/m/notifications'); await settle(page, 1500)
    const len0 = await histLen(page)
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'push-navigate', ticketId: 't-4', notificationType: 'comment.created' } })))
    await settle(page, 1500)
    check('push: мобильная карточка с вкладкой чата', path(page).startsWith('/m/tickets/t-4') && path(page).includes('tab=chat'), path(page))
    check('push: без подписи источника', (await page.locator('[data-testid="ticket-origin"]').count()) === 0)
    await page.goBack(); await settle(page, 1200)
    check('push: Back на предыдущий экран', path(page) === '/m/notifications' && (await histLen(page)) === len0 + 1)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  // ---------------- MAX ----------------
  await scenario('MAX Notifications', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB, max: true })
    await page.goto(BASE + '/max/notifications'); await settle(page, 2200)
    const { y: y0 } = await clickVisible(page, 'button.mobileNotificationBtn'); await settle(page, 1300)
    check('карточка в /max', path(page).startsWith('/max/tickets/'), path(page))
    check('подпись «Уведомления»', (await caption(page)) === 'Открыто из раздела «Уведомления»', await caption(page))
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 1800)
    check('«Назад»: /max/notifications и прокрутка', path(page) === '/max/notifications' && Math.abs((await scrollY(page)) - y0) <= 2, `${path(page)} ${await scrollY(page)} vs ${y0}`)
    await page.goForward(); await settle(page, 1200)
    check('Forward: снова карточка /max', path(page).startsWith('/max/tickets/'))
    // returnTo из раздела /m для карточки /max отбрасывается
    await page.evaluate(() => history.replaceState({ ...history.state, usr: { ticketNav: { v: 1, source: 'notifications', returnTo: '/m/notifications', originKey: 'x', originIdx: 0 } } }, ''))
    await page.reload(); await settle(page, 1800)
    check('returnTo чужого раздела (/m) отброшен', (await page.locator('[data-testid="ticket-origin"]').count()) === 0)
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await scenario('MAX Home + Chats', async () => {
    const { ctx, page, errs } = await session(browser, 'client', { viewport: MOB, max: true })
    await page.goto(BASE + '/max'); await settle(page, 2200)
    await page.locator('input.mobileHomeSearchBarInput').fill('Электрика'); await settle(page, 400)
    await clickVisible(page, 'a.mobileCardClickable', 100); await settle(page, 1300)
    check('Home: подпись «Главная», карточка /max', path(page).startsWith('/max/tickets/') && (await caption(page)) === 'Открыто из раздела «Главная»', path(page))
    await page.goBack(); await settle(page, 1800)
    check('Home Back: поиск восстановлен', (await page.locator('input.mobileHomeSearchBarInput').inputValue()) === 'Электрика')
    await page.goto(BASE + '/max/chats'); await settle(page, 2000)
    await page.getByText('ЗАЯВКИ', { exact: false }).first().click(); await settle(page, 400)
    await page.locator('a[href*="/max/tickets/"]').first().click(); await settle(page, 1300)
    check('Chats: подпись «Чаты»', (await caption(page)) === 'Открыто из раздела «Чаты»', await caption(page))
    await page.locator('a.mobileTicketBackBtn').click(); await settle(page, 1500)
    check('Chats «Назад»: /max/chats', path(page) === '/max/chats', path(page))
    check('ошибок нет', errs.length === 0, errs.join(' | '))
    await ctx.close()
  })

  await browser.close()
  console.log(results.join('\n'))
  const fails = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\nИТОГО: ${results.length - fails} PASS / ${fails} FAIL`)
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1) })
