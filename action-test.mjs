#!/usr/bin/env node
// ─── Lifecycle test ОДНОЙ заявки на стейдже (мутации разрешены) ────────────────
// Проверяет действия техника ПО ОДНОМУ с рефетчем статуса после каждого:
//   claim → start(IN_PROGRESS) → comment → complete(AWAITING_ACCEPTANCE)
// Запуск: node action-test.mjs <email> <пароль> [baseUrl]
const [, , email, password, baseArg] = process.argv
const BASE = (baseArg || 'http://127.0.0.1:3001').replace(/\/+$/, '')
let token = null

async function req(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const t = await res.text(); let j; try { j = t ? JSON.parse(t) : null } catch { j = t }
  return { status: res.status, ok: res.ok, json: j }
}
const statusOf = async (id) => (await req(`/tickets/${id}`)).json?.status

;(async () => {
  // login
  const login = await req('/auth/login', { method: 'POST', body: { email, password } })
  if (!login.ok) { console.error('login fail', login.json); process.exit(1) }
  token = login.json.access_token
  console.log(`✓ login: ${login.json.user.role} ${login.json.user.id.slice(0,8)}`)

  // выбрать ОДНУ claimable NEW-заявку
  const avail = await req('/tickets/available')
  const cand = (avail.json || []).find(t => t.canClaimByCurrentUser) || (avail.json || [])[0]
  if (!cand) { console.error('нет доступных заявок для теста'); process.exit(1) }
  console.log(`\nТест-заявка: #${cand.ticketNumber} ${cand.id}`)
  console.log(`  стартовый статус: ${cand.status} | canClaim=${cand.canClaimByCurrentUser}`)
  const id = cand.id

  // ① claim
  const c = await req(`/tickets/${id}/claim`, { method: 'POST' })
  console.log(`\n① claim → HTTP ${c.status} → статус: ${await statusOf(id)}${c.ok?'':' ✗ '+JSON.stringify(c.json)}`)

  // ② start → IN_PROGRESS
  const s1 = await req(`/tickets/${id}/status`, { method: 'PATCH', body: { status: 'IN_PROGRESS' } })
  console.log(`② start (IN_PROGRESS) → HTTP ${s1.status} → статус: ${await statusOf(id)}${s1.ok?'':' ✗ '+JSON.stringify(s1.json)}`)

  // ③ comment
  const cm = await req(`/tickets/${id}/comments`, { method: 'POST', body: { comment: 'Тех на объекте, приступил (action-test)' } })
  console.log(`③ comment → HTTP ${cm.status} → ${cm.ok ? JSON.stringify(cm.json) : '✗ '+JSON.stringify(cm.json)}`)

  // ④ complete → AWAITING_ACCEPTANCE
  const s2 = await req(`/tickets/${id}/status`, { method: 'PATCH', body: { status: 'AWAITING_ACCEPTANCE' } })
  console.log(`④ complete (AWAITING_ACCEPTANCE) → HTTP ${s2.status} → статус: ${await statusOf(id)}${s2.ok?'':' ✗ '+JSON.stringify(s2.json)}`)

  console.log(`\n✓ Цикл пройден на #${cand.ticketNumber}. Итоговый статус: ${await statusOf(id)}`)
})().catch(e => { console.error(e); process.exit(1) })
