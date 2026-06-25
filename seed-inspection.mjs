#!/usr/bin/env node
// Сид тест-данных Обходов на стейдже: шаблон + запущенный обход (через client.admin,
// ADMIN QA Client Co — у него есть локации и право POST /inspection/templates).
const BASE = 'http://127.0.0.1:3001'
const CLIENT = { email: 'client.admin@test.local', password: (process.env.STAGE_QA_PASSWORD || 'SET_STAGE_QA_PASSWORD') }
async function login(c){const r=await fetch(`${BASE}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});const j=await r.json();if(!r.ok)throw new Error('login '+JSON.stringify(j));return j.access_token}
const H=t=>({Authorization:`Bearer ${t}`})
async function jget(t,p){const r=await fetch(`${BASE}${p}`,{headers:H(t)});return r.json()}
async function jpost(t,p,b){const r=await fetch(`${BASE}${p}`,{method:'POST',headers:{...H(t),'Content-Type':'application/json'},body:JSON.stringify(b)});return{s:r.status,j:await r.json().catch(()=>null)}}

;(async()=>{
  const t=await login(CLIENT)
  // 1) шаблон
  const tpl=await jpost(t,'/inspection/templates',{
    name:'Ежедневный обход зала',
    description:'Проверка ключевых зон перед открытием',
    items:[
      {title:'Освещение в зале',description:'Все светильники работают',isRequired:true,sortOrder:0},
      {title:'Кондиционирование',description:'Температура в норме',isRequired:true,sortOrder:1},
      {title:'Чистота пола',isRequired:false,sortOrder:2},
      {title:'Санузлы',description:'Чистота и расходники',isRequired:true,sortOrder:3},
      {title:'Пожарные выходы свободны',isRequired:true,sortOrder:4},
    ],
  })
  console.log(`шаблон → HTTP ${tpl.s} | id=${tpl.j?.id?.slice(0,8)} | items=${tpl.j?.items?.length}`)
  if(tpl.s>=400){console.error(JSON.stringify(tpl.j));process.exit(1)}

  // 2) локация (FJ-002 если есть)
  const locs=await jget(t,'/locations')
  const loc=(locs.find(l=>l.platformCode==='FJ-002')||locs[0])
  console.log(`локация: ${loc?.name} (${loc?.id?.slice(0,8)})`)

  // 3) запустить обход
  const run=await jpost(t,'/inspection/runs',{templateId:tpl.j.id,locationId:loc.id,title:'Обход — '+loc.name})
  console.log(`обход → HTTP ${run.s} | id=${run.j?.id?.slice(0,8)} | status=${run.j?.status} | items=${run.j?.items?.length}`)
  if(run.s>=400){console.error(JSON.stringify(run.j));process.exit(1)}

  // 4) сверка
  const runs=await jget(t,'/inspection/runs')
  const tpls=await jget(t,'/inspection/templates')
  console.log(`\n✓ GET /inspection/runs=${runs.length}, /templates=${tpls.length}`)
  console.log('run list[0] поля:',Object.keys(runs[0]||{}).join(', '))
  console.log('run item[0] поля:',Object.keys(run.j?.items?.[0]||{}).join(', '))
})().catch(e=>{console.error('ERR',e.message);process.exit(1)})
