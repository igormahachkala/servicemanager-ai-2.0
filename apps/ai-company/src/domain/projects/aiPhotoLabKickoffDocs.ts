/** Structured excerpts from repo docs — source files under apps/ai-company/docs/ */

export type KickoffDocRef = {
  id: string
  title: string
  path: string
  summary: string
}

export type KickoffQaGate = {
  id: string
  label: string
  status: 'ready' | 'needs_fix' | 'blocked' | 'pending'
  note: string
}

export type KickoffDemoReadiness = {
  overall: 'ready' | 'needs_fix' | 'blocked'
  readyCount: number
  totalCount: number
  headline: string
  recommendation: string
  gates: KickoffQaGate[]
}

export const KICKOFF_DOC_CTO_PLAN: KickoffDocRef = {
  id: 'cto-plan',
  title: 'AI Photo Lab Sprint 1 CTO Plan',
  path: 'docs/delivery/ai-photo-lab-sprint-1-cto-plan.md',
  summary:
    'Sprint 1 = audit & stabilization, not greenfield. 13 tasks, 0 done, project 28%. Codex only after Owner approves backlog.',
}

export const KICKOFF_DOC_MAX_HANDOFF: KickoffDocRef = {
  id: 'max-handoff',
  title: 'AI-PHOTO-LAB-002 — Codex Handoff',
  path: 'docs/handoffs/AI-PHOTO-LAB-002-stabilize-mvp-codex-handoff.md',
  summary:
    'MAX technical audit → Codex stabilizes upload, analysis, zones, chat, history, mobile in ~/projects/ai-photo-lab.',
}

export const KICKOFF_DOC_QA_CHECKLIST: KickoffDocRef = {
  id: 'qa-checklist',
  title: 'AI Photo Lab Demo Readiness Checklist',
  path: 'docs/qa/ai-photo-lab-demo-readiness-checklist.md',
  summary:
    'Sentinel QA — 7/10 Ready, 3 Needs Fix. Conditional demo OK on pre-seeded check; avoid fresh upload until Ollama 500 fixed.',
}

export const KICKOFF_CTO_PLAN_EXCERPT = {
  weekGoal:
    'Owner demo on vitrina: upload → vision → zones → chat → report/history with QA checklist and deployment checklist approved.',
  priorities: [
    'P0: production health, local startup, Codex backlog Owner approval, upload + vision audit',
    'P1: zones, chat, report/history, QA checklist, deploy checklist',
    'P2: demo script, mobile pass, sprint review',
  ],
  ownerMustApprove: [
    'Codex task backlog (task-apl-013)',
    'MVP stabilization plan (task-apl-001)',
    'Deployment checklist (task-apl-011)',
    'Production deploy approval',
    'QA sign-off (task-apl-010)',
    'Scope freeze — no SMA coupling',
  ],
  codexScope: [
    'Ollama / qwen2.5vl:7b tuning',
    'UI fixes from upload & zone audits',
    'Bug fixes from QA runs',
    'PDF / report engine',
    'Production deploy after Owner sign-off',
  ],
}

export const KICKOFF_DEMO_READINESS: KickoffDemoReadiness = {
  overall: 'needs_fix',
  readyCount: 7,
  totalCount: 10,
  headline: 'Needs Fix — conditional demo OK',
  recommendation:
    'Use history check with saved zones (d27030bb-…) or manual zone edit. Avoid fresh photo upload until Ollama vision 500 is fixed.',
  gates: [
    { id: 'site', label: 'Site loads', status: 'ready', note: 'SPA renders on vitrina' },
    { id: 'health', label: 'Health endpoint', status: 'ready', note: 'GET /health → ok' },
    { id: 'upload', label: 'Photo upload', status: 'ready', note: 'POST /api/photo-checks' },
    {
      id: 'ai_analysis',
      label: 'AI analysis',
      status: 'needs_fix',
      note: 'Ollama HTTP 500 on new uploads — flaky fillRate',
    },
    {
      id: 'zones',
      label: 'Zones display',
      status: 'needs_fix',
      note: 'Sparse auto-zones on new upload',
    },
    { id: 'zone_edit', label: 'Manual zone edit', status: 'ready', note: 'PATCH zones + ZoneEditor' },
    { id: 'chat', label: 'Inspection chat', status: 'ready', note: 'Quick questions + persistence' },
    { id: 'history', label: 'History + report', status: 'ready', note: 'In-app technical report' },
    { id: 'mobile', label: 'Mobile layout', status: 'ready', note: 'Bottom nav usable at 390px' },
    { id: 'local_run', label: 'Local dev startup', status: 'ready', note: 'npm run dev on PORT 3002' },
  ],
}

export const KICKOFF_MAX_HANDOFF_EXCERPT = {
  title: 'Stabilize AI Photo Lab MVP flow',
  from: 'MAX',
  to: 'Codex',
  linkedTaskId: 'task-apl-001',
  status: 'ready',
  findings: [
    'Production health OK — GET /health status ok',
    'Ollama on prod — verify vision before demo',
    'Monolith files — fix surgically (App.jsx ~1720 lines)',
    'No automated tests — manual checklist + curl',
  ],
  targetRepo: '~/projects/ai-photo-lab',
}
