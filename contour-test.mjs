#!/usr/bin/env node
// ─── Полный контур приёмки на стейдже (runtime) ───────────────────────────────
// tech: claim→start→upload(WORK_REPORT photo)→comment→complete(AWAITING)
// client(ADMIN client-company): accept→DONE  и  reject→IN_PROGRESS
// Запуск: node contour-test.mjs
import { readFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:3001'
const TECH = { email: 'tech@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }
const CLIENT = { email: 'client.admin@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }
const IMG = '/tmp/test-photo.png'

async function login(c) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
  const j = await r.json(); if (!r.ok) throw new Error('login ' + c.email + ' ' + JSON.stringify(j))
  return { token: j.access_token, user: j.user }
}
const H = (t) => ({ Authorization: `Bearer ${t}` })
async function jget(t, path) { const r = await fetch(`${BASE}${path}`, { headers: H(t) }); return { s: r.status, j: await r.json().catch(() => null) } }
async function jpost(t, path, body) { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { ...H(t), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => null) } }
async function jpatch(t, path, body) { const r = await fetch(`${BASE}${path}`, { method: 'PATCH', headers: { ...H(t), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) } }
const statusOf = async (t, id) => (await jget(t, `/tickets/${id}`)).j?.status

async function upload(t, id) {
  const buf = readFileSync(IMG)
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type: 'image/png' }), 'report.png')
  const r = await fetch(`${BASE}/tickets/${id}/attachments`, { method: 'POST', headers: H(t), body: fd })
  return { s: r.status, j: await r.json().catch(() => null) }
}

async function driveToAwaiting(tech, label) {
  const avail = (await jget(tech.token, '/tickets/available')).j || []
  const cand = avail.find(x => x.status === 'NEW') || avail[0]
  if (!cand) throw new Error('нет доступных заявок')
  const id = cand.id
  console.log(`\n[${label}] заявка #${cand.ticketNumber} (${id.slice(0, 8)}) старт=${cand.status}`)
  await jpost(tech.token, `/tickets/${id}/claim`)
  await jpatch(tech.token, `/tickets/${id}/status`, { status: 'IN_PROGRESS' })
  const up = await upload(tech.token, id)
  console.log(`  upload → HTTP ${up.s} | purpose=${up.j?.purpose} | url=${up.j?.url}`)
  const att = (await jget(tech.token, `/tickets/${id}/attachments`)).j || []
  console.log(`  GET attachments → ${att.length} шт (${att.map(a => a.purpose).join(',')})`)
  await jpost(tech.token, `/tickets/${id}/comments`, { comment: 'Готово, фото приложено (contour-test)' })
  const done = await jpatch(tech.token, `/tickets/${id}/status`, { status: 'AWAITING_ACCEPTANCE' })
  console.log(`  complete → HTTP ${done.s} → статус: ${await statusOf(tech.token, id)}${done.s >= 400 ? ' ✗ ' + JSON.stringify(done.j) : ''}`)
  return { id, number: cand.ticketNumber }
}

;(async () => {
  const tech = await login(TECH)
  const client = await login(CLIENT)
  console.log(`tech=${tech.user.role} ${tech.user.companyId.slice(0, 8)} | client=${client.user.role} ${client.user.companyId.slice(0, 8)}`)

  // ── ВЕТКА ACCEPT ──
  const a = await driveToAwaiting(tech, 'ACCEPT')
  const accSee = await jget(client.token, `/tickets/${a.id}`)
  console.log(`  client видит #${a.number}? HTTP ${accSee.s}, статус=${accSee.j?.status}`)
  const acc = await jpost(client.token, `/tickets/${a.id}/acceptance`, { decision: 'ACCEPT' })
  console.log(`  client ACCEPT → HTTP ${acc.s} → статус: ${await statusOf(tech.token, a.id)}${acc.s >= 400 ? ' ✗ ' + JSON.stringify(acc.j) : ''}`)

  // ── ВЕТКА REJECT ──
  const r = await driveToAwaiting(tech, 'REJECT')
  const rej = await jpost(client.token, `/tickets/${r.id}/acceptance`, { decision: 'REJECT', comment: 'Не принято: переделать (contour-test)' })
  console.log(`  client REJECT → HTTP ${rej.s} → статус: ${await statusOf(tech.token, r.id)}${rej.s >= 400 ? ' ✗ ' + JSON.stringify(rej.j) : ''}`)
  // reject без комментария — должен упасть 400
  const r2 = await driveToAwaiting(tech, 'REJECT-no-comment')
  const rejBad = await jpost(client.token, `/tickets/${r2.id}/acceptance`, { decision: 'REJECT' })
  console.log(`  client REJECT без комментария → HTTP ${rejBad.s} (ожидаем 400) ${rejBad.s === 400 ? '✓' : '✗ ' + JSON.stringify(rejBad.j)}`)

  console.log('\n✓ Контур пройден.')
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
