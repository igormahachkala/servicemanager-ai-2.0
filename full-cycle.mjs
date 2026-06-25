#!/usr/bin/env node
// Полный контур приёмки, runtime, на свежесозданных заявках FJ-002 (QA Client Co):
//  client.admin создаёт → tech@test.local claim→start→photo→comment→complete(AWAITING)
//  → client.admin ACCEPT(→DONE) и REJECT(комментарий → IN_PROGRESS; без — 400).
import { readFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:3001'
const IMG = '/tmp/test-photo.png'
const LC = '10000000-0000-4000-8000-000000000001'   // QA Client Co
const LOC = '30000000-0000-4000-8000-000000000002'  // Фудзияма — Арбат (FJ-002), привязка tech@test.local
const CAT = '40000000-0000-4000-8000-000000000001'  // Общее обслуживание
const CLIENT = { email: 'client.admin@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }
const TECH = { email: 'tech@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }

async function login(c){const r=await fetch(`${BASE}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});const j=await r.json();if(!r.ok)throw new Error('login '+c.email+' '+JSON.stringify(j));return j.access_token}
const H=t=>({Authorization:`Bearer ${t}`})
const sc=p=>p+(p.includes('?')?'&':'?')+'linkedClientCompanyId='+LC
async function jget(t,p){const r=await fetch(`${BASE}${p}`,{headers:H(t)});return{s:r.status,j:await r.json().catch(()=>null)}}
async function jpost(t,p,b){const r=await fetch(`${BASE}${p}`,{method:'POST',headers:{...H(t),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json().catch(()=>null)}}
async function jpatch(t,p,b){const r=await fetch(`${BASE}${p}`,{method:'PATCH',headers:{...H(t),'Content-Type':'application/json'},body:JSON.stringify(b)});return{s:r.status,j:await r.json().catch(()=>null)}}
const stOf=async(t,id)=>(await jget(t,sc(`/tickets/${id}`))).j?.status
async function up(t,id){const buf=readFileSync(IMG);const fd=new FormData();fd.append('file',new Blob([buf],{type:'image/png'}),'report.png');const r=await fetch(`${BASE}${sc(`/tickets/${id}/attachments`)}`,{method:'POST',headers:H(t),body:fd});return{s:r.status,j:await r.json().catch(()=>null)}}

async function createTicket(client,label){
  const r=await jpost(client,'/tickets',{locationId:LOC,problemCategoryId:CAT,problemText:`Контур приёмки — ${label}`,urgency:'NOT_URGENT',requesterName:'QA Acceptance'})
  if(r.s>=400)throw new Error('create '+label+' '+JSON.stringify(r.j))
  const t=r.j.ticket // id в .ticket; create может авто-назначить
  console.log(`  создана #${t.ticketNumber} (${t.id.slice(0,8)}) статус=${t.status} autoAssigned=${r.j.autoAssigned}`)
  return t.id
}
async function drive(tech,id,n){
  const cur=await stOf(tech,id)
  // если NEW — claim'им техником; если уже ASSIGNED (авто-назначение на bound-техника) — claim не нужен
  const c=cur==='NEW'?await jpost(tech,sc(`/tickets/${id}/claim`)):{s:'skip('+cur+')'}
  const s1=await jpatch(tech,sc(`/tickets/${id}/status`),{status:'IN_PROGRESS'})
  const u=await up(tech,id)
  const cm=await jpost(tech,sc(`/tickets/${id}/comments`),{comment:`Готово, фото (#${n})`})
  const d=await jpatch(tech,sc(`/tickets/${id}/status`),{status:'AWAITING_ACCEPTANCE'})
  console.log(`[tech] #${n}: claim ${c.s} → start ${s1.s} → upload ${u.s}(${u.j?.purpose}) → comment ${cm.s} → complete ${d.s} → статус: ${await stOf(tech,id)}`)
}

;(async()=>{
  const client=await login(CLIENT)
  const tech=await login(TECH)
  console.log('создаю 2 заявки на FJ-002…')
  const A=await createTicket(client,'ACCEPT')
  const B=await createTicket(client,'REJECT')

  await drive(tech,A,'A')
  await drive(tech,B,'B')

  console.log('\n── ПРИЁМКА (client.admin, ADMIN client-company) ──')
  const acc=await jpost(client,`/tickets/${A}/acceptance`,{decision:'ACCEPT'})
  console.log(`① ACCEPT A → HTTP ${acc.s} → статус: ${await stOf(client,A)} ${acc.s<300?'✓':'✗ '+JSON.stringify(acc.j)}`)

  const bad=await jpost(client,`/tickets/${B}/acceptance`,{decision:'REJECT'})
  console.log(`② REJECT B без комментария → HTTP ${bad.s}: ${JSON.stringify(bad.j?.message)} ${bad.s===400?'✓':'✗'}`)

  const rej=await jpost(client,`/tickets/${B}/acceptance`,{decision:'REJECT',comment:'Не принято: переделать узел'})
  console.log(`③ REJECT B с комментарием → HTTP ${rej.s} → статус: ${await stOf(client,B)} ${rej.s<300?'✓':'✗ '+JSON.stringify(rej.j)}`)
})().catch(e=>{console.error('ERR',e.message);process.exit(1)})
