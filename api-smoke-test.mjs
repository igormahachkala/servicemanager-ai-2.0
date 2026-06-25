#!/usr/bin/env node
// ─── API smoke test (server-side, без CORS) ────────────────────────────────────
// Логинит техника, дёргает реальные эндпоинты, сохраняет СЫРЫЕ JSON в ./smoke-out/
// и сверяет форму ответа с контрактом из src/api/client.ts.
//
// Запуск:  node api-smoke-test.mjs <email> <пароль> [baseUrl]
// По умолчанию baseUrl = https://api.servicemanagerai.ru (прод, только чтение).

import { mkdir, writeFile } from 'node:fs/promises'

const [, , email, password, baseArg] = process.argv
const BASE = (baseArg || process.env.API_BASE || 'https://api.servicemanagerai.ru').replace(/\/+$/, '')
const OUT = new URL('./smoke-out/', import.meta.url)

if (!email || !password) {
  console.error('Использование: node api-smoke-test.mjs <email> <пароль> [baseUrl]')
  process.exit(2)
}

const mask = (s) => (s ? s.slice(0, 2) + '***' : '')
console.log(`▶ Base: ${BASE}`)
console.log(`▶ User: ${mask(email)}  (пароль скрыт)\n`)

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, ok: res.ok, json }
}

async function save(name, data) {
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL(name, OUT), JSON.stringify(data, null, 2))
  console.log(`  ↳ сохранено smoke-out/${name}`)
}

const keys = (o) => (o && typeof o === 'object' ? Object.keys(o) : [])
const note = [] // расхождения с контрактом

;(async () => {
  // 1) LOGIN ────────────────────────────────────────────────────────────────
  console.log('① POST /auth/login')
  const login = await req('/auth/login', { method: 'POST', body: { email, password } })
  console.log(`   HTTP ${login.status}`)
  if (!login.ok) {
    console.error('   ✗ Логин не прошёл:', JSON.stringify(login.json))
    process.exit(1)
  }
  await save('login.json', login.json)
  const token = login.json?.access_token
  const user = login.json?.user
  console.log(`   access_token: ${token ? 'есть' : 'НЕТ'} | user.role: ${user?.role} | user.id: ${user?.id}`)
  if (!token) note.push('login: нет access_token в ответе')
  if (!user) note.push('login: нет user в ответе')
  console.log(`   user поля: ${keys(user).join(', ')}\n`)

  // 2) ME ─────────────────────────────────────────────────────────────────────
  console.log('② GET /auth/me')
  const me = await req('/auth/me', { token })
  console.log(`   HTTP ${me.status} | поля: ${keys(me.json).join(', ')}`)
  await save('me.json', me.json)
  console.log()

  // 3) BOARD ───────────────────────────────────────────────────────────────────
  console.log('③ GET /tickets/board')
  const board = await req('/tickets/board', { token })
  console.log(`   HTTP ${board.status}`)
  if (board.status === 404) {
    note.push('board: 404 — использовать GET /tickets')
    console.log('   ✗ 404 — пробую GET /tickets')
    const list = await req('/tickets', { token })
    console.log(`   GET /tickets → HTTP ${list.status}, элементов: ${Array.isArray(list.json) ? list.json.length : 'n/a'}`)
    await save('tickets-list.json', list.json)
  } else if (board.ok) {
    await save('board.json', board.json)
    const cols = board.json?.columns ?? []
    const grouped = Array.isArray(cols)
    console.log(`   группировка по статусу (columns): ${grouped ? 'ДА' : 'НЕТ'}`)
    if (!grouped) note.push('board: нет массива columns — форма ответа отличается от контракта')
    if (grouped) {
      console.log('   колонки:', cols.map((c) => `${c.status}=${c.total ?? c.cards?.length}`).join('  '))
      console.log(`   meta: ${keys(board.json?.meta).join(', ')}`)
    }
    const firstCard = cols.flatMap((c) => c.cards ?? [])[0]
    if (firstCard) {
      console.log(`   поля карточки: ${keys(firstCard).join(', ')}`)
      for (const f of ['phone', 'requesterPhone', 'urgencyReason', 'icon', 'waitingHours'])
        if (!(f in firstCard)) note.push(`board.card: нет поля '${f}' (ожидаемо — мапим TODO)`)
      const hasAwaiting = cols.some((c) => c.status === 'AWAITING_ACCEPTANCE')
      console.log(`   статус AWAITING_ACCEPTANCE в колонках: ${hasAwaiting ? 'есть' : 'нет (нет таких заявок?)'}`)

      // 4) TICKET DETAIL ───────────────────────────────────────────────────────
      console.log('\n④ GET /tickets/:id (первая карточка)')
      const det = await req(`/tickets/${firstCard.id}`, { token })
      console.log(`   HTTP ${det.status} | поля: ${keys(det.json).join(', ')}`)
      await save('ticket-detail.json', det.json)
      console.log(`   requesterPhone: ${det.json?.requesterPhone ?? '—'} | meta.availableActions: ${JSON.stringify(det.json?.meta?.availableActions ?? null)}`)
    } else {
      console.log('   (карточек нет — у аккаунта пустая доска)')
    }
  } else {
    note.push(`board: HTTP ${board.status} — ${JSON.stringify(board.json)}`)
    console.log('   ✗', JSON.stringify(board.json))
  }

  // 5) AVAILABLE ─────────────────────────────────────────────────────────────
  console.log('\n⑤ GET /tickets/available')
  const avail = await req('/tickets/available', { token })
  console.log(`   HTTP ${avail.status} | элементов: ${Array.isArray(avail.json) ? avail.json.length : 'n/a'}`)
  if (avail.ok) await save('available.json', avail.json)

  // 6) СПРАВОЧНИКИ + СОЗДАНИЕ ЗАЯВКИ ──────────────────────────────────────────
  console.log('\n⑥ Справочники + POST /tickets')
  // resolve scope: провайдер-техник видит локации/категории linked-client компании
  let scope = undefined
  let locs = (await req('/locations', { token })).json
  if (Array.isArray(locs) && locs.length === 0) {
    const bc = (await req('/technicians/me/bound-contexts', { token })).json
    scope = Array.isArray(bc) ? bc?.[0]?.clientCompany?.id : undefined
    if (scope) locs = (await req(`/locations?companyId=${scope}`, { token })).json
  }
  const cats = (await req(`/problem-categories${scope ? `?companyId=${scope}` : ''}`, { token })).json
  console.log(`   GET /locations → ${Array.isArray(locs) ? locs.length : 'n/a'} | GET /problem-categories → ${Array.isArray(cats) ? cats.length : 'n/a'}${scope ? ` (scope=${String(scope).slice(0, 8)})` : ''}`)
  if (Array.isArray(locs) && locs[0]) console.log(`   location поля: ${keys(locs[0]).join(', ')}`)
  if (Array.isArray(cats) && cats[0]) console.log(`   category поля: ${keys(cats[0]).join(', ')}`)
  if (Array.isArray(locs) && locs[0]) {
    const body = {
      locationId: locs[0].id,
      problemCategoryId: (Array.isArray(cats) && cats[0]) ? cats[0].id : undefined,
      problemText: 'smoke-test: проверка POST /tickets',
      urgency: 'NOT_URGENT',
      ...(scope ? { clientCompanyId: scope } : {}),
    }
    const created = await req('/tickets', { method: 'POST', token, body })
    const id = created.json?.ticket?.id // ВАЖНО: id в .ticket.id, не на верхнем уровне
    console.log(`   POST /tickets → HTTP ${created.status} | ticket.id: ${id ? 'есть (' + id.slice(0, 8) + ')' : 'НЕТ'} | #${created.json?.ticket?.ticketNumber ?? '—'}`)
    if (!id) note.push('POST /tickets: id не вернулся (ожидался в .ticket.id)')
    else await save('created-ticket.json', created.json)
  } else {
    console.log('   (нет доступных локаций — создание пропущено)')
    note.push('create: нет доступных локаций для POST /tickets')
  }

  // ── Итог ──────────────────────────────────────────────────────────────────
  console.log('\n─── Расхождения с контрактом ───')
  if (note.length === 0) console.log('  нет — форма совпадает с src/api/client.ts')
  else for (const n of note) console.log('  •', n)
  console.log('\n✓ Готово. Сырые JSON — в smoke-out/ (НЕ коммитить: могут содержать перс. данные).')
})().catch((e) => { console.error('Ошибка:', e); process.exit(1) })
