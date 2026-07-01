import type { HandoffChecklistItem } from '../handoff/handoff'
import type { HandoffPackage } from '../handoff/handoffPackage'
import { buildHandoffPackage } from '../handoff/handoffPackage'
import type { HandoffTemplate } from '../handoff/handoffTemplates'

/** Stable id for AI-PHOTO-LAB-002 Codex handoff (upsert-safe). */
export const AI_PHOTO_LAB_HANDOFF_002_ID = 'handoff-apl-002-stabilize-mvp'

export const AI_PHOTO_LAB_HANDOFF_002_TEMPLATE_ID = 'tpl-codex-apl-stabilize-mvp'

export const AI_PHOTO_LAB_HANDOFF_002_TASK_ID = 'task-apl-001'

export const AI_PHOTO_LAB_HANDOFF_002_TITLE = 'Stabilize AI Photo Lab MVP flow'

const LOCAL_REPO = '~/projects/ai-photo-lab'

const PROD_PATH = '/opt/ai-photo-lab'

const SITE = 'https://vitrina.sma-assistants.ru'

export const AI_PHOTO_LAB_TARGET_FILES: string[] = [
  `${LOCAL_REPO}/package.json`,
  `${LOCAL_REPO}/vite.config.js`,
  `${LOCAL_REPO}/docs/deploy.md`,
  `${LOCAL_REPO}/src/main.jsx`,
  `${LOCAL_REPO}/src/App.jsx`,
  `${LOCAL_REPO}/src/ZoneEditor.jsx`,
  `${LOCAL_REPO}/src/styles.css`,
  `${LOCAL_REPO}/server/index.js`,
  `${LOCAL_REPO}/server/ollama.js`,
  `${LOCAL_REPO}/server/db.js`,
  `${LOCAL_REPO}/server/storage.js`,
  `${LOCAL_REPO}/server/env.js`,
]

export const AI_PHOTO_LAB_MVP_CHECKLIST: Omit<HandoffChecklistItem, 'done'>[] = [
  { id: 'chk-local-run', label: 'Local dev: npm install && npm run dev — SPA + API on PORT 3002' },
  { id: 'chk-prod-health', label: `Production health: GET ${SITE}/health → status ok, spa true` },
  { id: 'chk-upload', label: 'Photo upload: POST /api/photo-checks (multipart image) → check id + stored image' },
  { id: 'chk-ai-analysis', label: 'AI analysis: Ollama qwen2.5vl:7b returns parsedResult (status, fillRate, zones)' },
  { id: 'chk-visual-zones', label: 'Visual zones: overlay renders on photo from parsedResult / zones JSON' },
  { id: 'chk-manual-zone-edit', label: 'Manual zone edit: ZoneEditor → PATCH /api/photo-checks/:id/zones persists' },
  { id: 'chk-inspection-chat', label: 'Inspection chat: GET/POST /api/photo-checks/:id/chat with check context' },
  { id: 'chk-report-history', label: 'Report/history: GET /api/photo-checks lists prior checks; detail view loads' },
  { id: 'chk-mobile-view', label: 'Mobile view: bottom nav (check/chat/history/learning/settings), zone editor mobile panels' },
  { id: 'chk-deploy', label: `Deploy procedure: npm run build, PM2 cwd ${PROD_PATH}, nginx/Caddy, preserve data/ + uploads/` },
]

export const AI_PHOTO_LAB_HANDOFF_COMMANDS: string[] = [
  `cd ${LOCAL_REPO}`,
  'node -v && npm -v',
  'cp .env.example .env   # if missing',
  'npm install',
  'npm run dev            # concurrent server + vite client',
  'npm run build && npm start',
  'curl -s http://127.0.0.1:3002/health | jq',
  'curl -s -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:3002/',
  `curl -s ${SITE}/health | jq`,
  'ollama pull qwen2.5vl:7b',
  'curl -s "$OLLAMA_BASE_URL/api/tags"',
  `pm2 start server/index.js --name ai-photo-lab --cwd ${PROD_PATH}`,
  'pm2 logs ai-photo-lab --lines 50',
]

export const AI_PHOTO_LAB_HANDOFF_CONSTRAINTS: string[] = [
  'Work ONLY in ~/projects/ai-photo-lab — do not modify apps/ai-company or ServiceManager core.',
  'Do not deploy to production (/opt/ai-photo-lab) without explicit Owner approval.',
  'Preserve multi-step MVP flows: upload → analysis → zones → chat → history.',
  'No new npm dependencies unless required to fix a blocker — document rationale.',
  'Do not couple to ServiceManager tickets or companyId — standalone vitrina MVP.',
  'Avoid large refactors (App.jsx ~1720 lines) unless required to unblock a checklist item.',
]

export const AI_PHOTO_LAB_ACCEPTANCE_CRITERIA: string[] = [
  'All 10 MVP checklist flows pass locally with Ollama running (qwen2.5vl:7b).',
  'npm run build completes without errors; npm start serves SPA (GET / returns 200 HTML).',
  'GET /health reports status ok, spa true, visionModel set.',
  'Upload → analysis → zones overlay → manual PATCH zones → chat → history works end-to-end.',
  'Mobile layout: bottom nav and ZoneEditor mobile panels usable at ≤768px width.',
  'No regressions in onboarding, settings accordion, examples, or feedback endpoints.',
  'Production deploy steps documented if code changes affect build/runtime — no silent deploy.',
  'Handoff response includes changed files, commands run, and explicit go/no-go for prod.',
]

export const AI_PHOTO_LAB_EXPECTED_RESPONSE_FORMAT = [
  '## Summary',
  '2–4 sentences: what was stabilized and overall MVP readiness.',
  '',
  '## Checklist results',
  'Table: Flow | Status (pass/fail) | Notes | Evidence (screenshot/log snippet).',
  '',
  '## Changed files',
  'Bulleted list with one-line rationale per file.',
  '',
  '## Commands run',
  'Copy-paste block of commands executed and exit codes.',
  '',
  '## Blockers / follow-ups',
  'Items still failing, Ollama/prod env risks, or Owner decisions needed.',
  '',
  '## Production deploy recommendation',
  'go | no-go — with pre-deploy checklist if go.',
].join('\n')

const CURRENT_STATE = [
  'MAX technical audit (AI-PHOTO-LAB-002) completed 2026-06-24.',
  '',
  'Stack: React 19 + Vite 8, Express 4, SQLite (better-sqlite3), Ollama vision qwen2.5vl:7b.',
  `Local repo: ${LOCAL_REPO}. Production: ${PROD_PATH} on 194.67.92.12. Site: ${SITE}.`,
  '',
  'Implemented features (standalone repo): photo upload, AI analysis, visual zones, manual zone editing (ZoneEditor.jsx),',
  'inspection chat, check history, training examples, mobile bottom nav, onboarding, settings, zoom/pan, feedback.',
  '',
  'Key API routes (server/index.js):',
  'POST /api/photo-checks · GET /api/photo-checks · GET /api/photo-checks/:id',
  'PATCH /api/photo-checks/:id/zones · GET|POST /api/photo-checks/:id/chat',
  'POST /api/photo-checks/:id/feedback · GET /health',
  '',
  'Audit findings:',
  `- Production ${SITE}/health returns status ok, spa true, version 0.1.0 (verified).`,
  '- Health payload shows ollamaBaseUrl http://localhost:11434 and nodeEnv development — verify Ollama reachable on prod before demo.',
  '- App.jsx (~1720 lines), ZoneEditor.jsx (~839), server/index.js (~726) — monolith; fix surgically only.',
  '- No test script in package.json; validation is manual checklist + curl.',
  '',
  'Goal for Codex: stabilize end-to-end MVP employee flow for vitrina inspection demo — not ServiceManager integration.',
].join('\n')

const PROJECT_SUMMARY =
  'Internal MVP «ИИ Контроль витрин» — AI-powered showcase inspection vitrina. First product delivered via AI Company; Codex implements code fixes in standalone repo.'

export function buildAiPhotoLabHandoff002Package(): HandoffPackage {
  return buildHandoffPackage({
    projectTitle: 'AI Photo Lab / ИИ Контроль витрин',
    projectSummary: PROJECT_SUMMARY,
    workspaceName: 'AI Photo Lab / ИИ Контроль витрин',
    taskTitle: 'MVP audit and stabilization plan',
    taskDescription:
      'Cross-functional audit complete — Codex executes stabilization of upload/analysis/zones/chat/history/mobile/deploy flows.',
    currentState: CURRENT_STATE,
    files: AI_PHOTO_LAB_TARGET_FILES,
    constraints: AI_PHOTO_LAB_HANDOFF_CONSTRAINTS,
    commands: AI_PHOTO_LAB_HANDOFF_COMMANDS,
    acceptanceCriteria: AI_PHOTO_LAB_ACCEPTANCE_CRITERIA,
    expectedResponseFormat: AI_PHOTO_LAB_EXPECTED_RESPONSE_FORMAT,
  })
}

export function buildAiPhotoLabHandoff002Checklist(): HandoffChecklistItem[] {
  return AI_PHOTO_LAB_MVP_CHECKLIST.map((item) => ({ ...item, done: true }))
}

/** Registry entry for AI-PHOTO-LAB-002 Codex handoff template. */
export function buildAiPhotoLabHandoff002Template(): HandoffTemplate {
  return {
    id: AI_PHOTO_LAB_HANDOFF_002_TEMPLATE_ID,
    name: 'AI Photo Lab MVP stabilization',
    description:
      'Codex handoff for AI-PHOTO-LAB-002 — stabilize vitrina MVP flows in ~/projects/ai-photo-lab.',
    target: 'codex',
    priority: 'critical',
    title: AI_PHOTO_LAB_HANDOFF_002_TITLE,
    descriptionTemplate:
      'MAX completed technical audit — Codex executes stabilization of upload/analysis/zones/chat/history/mobile/deploy flows.',
    instructions:
      'Review the handoff package, work only in ~/projects/ai-photo-lab, run the checklist flows, and return structured results.',
    expectedResult:
      'All MVP checklist flows pass locally; build succeeds; handoff response includes changed files, commands, and go/no-go for production.',
    constraints: AI_PHOTO_LAB_HANDOFF_CONSTRAINTS,
    checklist: AI_PHOTO_LAB_MVP_CHECKLIST,
    packageDefaults: {
      currentState: CURRENT_STATE,
      files: AI_PHOTO_LAB_TARGET_FILES,
      commands: AI_PHOTO_LAB_HANDOFF_COMMANDS,
      acceptanceCriteria: AI_PHOTO_LAB_ACCEPTANCE_CRITERIA,
      expectedResponseFormat: AI_PHOTO_LAB_EXPECTED_RESPONSE_FORMAT,
    },
  }
}
