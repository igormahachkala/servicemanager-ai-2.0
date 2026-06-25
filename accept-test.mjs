#!/usr/bin/env node
// Runtime приёмки: назначенный техник доводит заявку до AWAITING_ACCEPTANCE
// (start→photo(WORK_REPORT)→comment→complete), затем client.admin (ADMIN client-company)
// принимает одну и отклоняет другую. Заявки принадлежат QA Client Co.
import { readFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:3001'
const IMG = '/tmp/test-photo.png'
const CLIENT = { email: 'client.admin@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }
const T2 = { tech: { email: 'zosimov.tech1@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }, id: '50000000-0000-4000-8000-000000000002', n: 2 }
const T3 = { tech: { email: 'other.sub.tech@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }, id: '50000000-0000-4000-8000-000000000003', n: 3 }

async function login(c){const r=await fetch(`${BASE}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});const j=await r.json();if(!r.ok)throw new Error('login '+c.email+' '+JSON.stringify(j));return j.access_token}
const H=t=>({Authorization:`Bearer ${t}`})
async function jget(t,p){const r=await fetch(`${BASE}${p}`,{headers:H(t)});return{s:r.status,j:await r.json().catch(()=>null)}}
async function jpost(t,p,b){const r=await fetch(`${BASE}${p}`,{method:'POST',headers:{...H(t),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json().catch(()=>null)}}
async function jpatch(t,p,b){const r=await fetch(`${BASE}${p}`,{method:'PATCH',headers:{...H(t),'Content-Type':'application/json'},body:JSON.stringify(b)});return{s:r.status,j:await r.json().catch(()=>null)}}
const statusOf=async(t,id)=>(await jget(t,`/tickets/${id}`)).j?.status
async function upload(t,id){const buf=readFileSync(IMG);const fd=new FormData();fd.append('file',new Blob([buf],{type:'image/png'}),'report.png');const r=await fetch(`${BASE}/tickets/${id}/attachments`,{method:'POST',headers:H(t),body:fd});return{s:r.status,j:await r.json().catch(()=>null)}}

// Провайдер-техник видит client-заявку только через linked-client scope
const LC = '10000000-0000-4000-8000-000000000001' // QA Client Co
const sc = (p) => p + (p.includes('?') ? '&' : '?') + 'linkedClientCompanyId=' + LC
async function uploadScoped(t,id){const buf=readFileSync(IMG);const fd=new FormData();fd.append('file',new Blob([buf],{type:'image/png'}),'report.png');const r=await fetch(`${BASE}${sc(`/tickets/${id}/attachments`)}`,{method:'POST',headers:H(t),body:fd});return{s:r.status,j:await r.json().catch(()=>null)}}

async function driveToAwaiting(T){
  const tok=await login(T.tech)
  let st=(await jget(tok,sc(`/tickets/${T.id}`))).j?.status
  if(st==='ASSIGNED') await jpatch(tok,sc(`/tickets/${T.id}/status`),{status:'IN_PROGRESS'})
  const up=await uploadScoped(tok,T.id)
  await jpost(tok,sc(`/tickets/${T.id}/comments`),{comment:`Готово, фото приложено (#${T.n})`})
  const done=await jpatch(tok,sc(`/tickets/${T.id}/status`),{status:'AWAITING_ACCEPTANCE'})
  console.log(`[tech ${T.tech.email}] #${T.n}: upload ${up.s}(${up.j?.purpose}) → complete ${done.s} → ${(await jget(tok,sc(`/tickets/${T.id}`))).j?.status}`)
}

;(async()=>{
  const client=await login(CLIENT)
  // довести обе до AWAITING
  await driveToAwaiting(T2)
  await driveToAwaiting(T3)

  // ① ACCEPT #2 → DONE
  const acc=await jpost(client,`/tickets/${T2.id}/acceptance`,{decision:'ACCEPT'})
  console.log(`\n① client.admin ACCEPT #${T2.n} → HTTP ${acc.s} → статус: ${await statusOf(client,T2.id)} ${acc.s<300?'✓':'✗ '+JSON.stringify(acc.j)}`)

  // ② REJECT #3 без комментария → 400
  const bad=await jpost(client,`/tickets/${T3.id}/acceptance`,{decision:'REJECT'})
  console.log(`② client.admin REJECT #${T3.n} без комментария → HTTP ${bad.s} ${bad.s===400?'✓ (нужен комментарий)':'✗ '+JSON.stringify(bad.j)}`)
  // ③ REJECT #3 с комментарием → IN_PROGRESS
  const rej=await jpost(client,`/tickets/${T3.id}/acceptance`,{decision:'REJECT',comment:'Не принято: переделать узел (accept-test)'})
  console.log(`③ client.admin REJECT #${T3.n} с комментарием → HTTP ${rej.s} → статус: ${await statusOf(client,T3.id)} ${rej.s<300?'✓':'✗ '+JSON.stringify(rej.j)}`)
})().catch(e=>{console.error('ERR',e.message);process.exit(1)})
