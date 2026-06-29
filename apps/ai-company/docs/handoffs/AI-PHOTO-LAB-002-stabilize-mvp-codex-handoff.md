# AI-PHOTO-LAB-002 — Codex Handoff

**Title:** Stabilize AI Photo Lab MVP flow  
**From:** MAX (ag-max) — Senior Developer  
**To:** Codex  
**Task:** task-apl-001 (MVP audit and stabilization plan)  
**Date:** 2026-06-24  
**Status:** Ready for implementation  

---

## Project context

| Item | Value |
|------|-------|
| Product | AI Photo Lab / ИИ Контроль витрин |
| Type | Internal MVP — AI showcase inspection vitrina |
| Local repo | `~/projects/ai-photo-lab` |
| Production path | `/opt/ai-photo-lab` on `194.67.92.12` |
| Site | https://vitrina.sma-assistants.ru |
| Health | https://vitrina.sma-assistants.ru/health |
| Stack | React 19 + Vite 8, Express 4, SQLite (better-sqlite3), Ollama |
| Vision model | `qwen2.5vl:7b` |
| Process | Digital employees audit/plan in AI Company; **Codex implements in ai-photo-lab repo** |

**Out of scope:** ServiceManager integration, `companyId` coupling, changes to `apps/ai-company`.

---

## Current features (implemented)

- Photo upload (`POST /api/photo-checks`)
- AI analysis via Ollama vision (parsedResult: status, fillRate, zones, recommendation)
- Visual zones overlay on photo
- Manual zone editing (`ZoneEditor.jsx`, `PATCH /api/photo-checks/:id/zones`)
- Inspection chat (`GET|POST /api/photo-checks/:id/chat`)
- Check history (`GET /api/photo-checks`, detail by id)
- Training examples, source-of-truth uploads
- Mobile bottom nav (check / chat / history / learning / settings)
- Onboarding (`localStorage.aiPhotoLabOnboarding`)
- Settings accordion, zoom/pan, feedback endpoint
- HTTPS production domain, PM2, SPA from `dist/`

---

## Audit findings (MAX, 2026-06-24)

1. **Production health OK** — `GET /health` → `status: ok`, `spa: true`, `version: 0.1.0`.
2. **Ollama on prod** — health shows `ollamaBaseUrl: http://localhost:11434`, `nodeEnv: development`. Verify vision analysis works on production before demo.
3. **Monolith files** — `App.jsx` ~1720 lines, `ZoneEditor.jsx` ~839, `server/index.js` ~726. Fix surgically; no broad refactor unless blocking.
4. **No automated tests** — validation via manual checklist + curl.
5. **Persistence** — `data/ai-photo-lab.sqlite` and `uploads/` must survive deploys.

---

## Files / paths

```
~/projects/ai-photo-lab/
├── package.json
├── vite.config.js
├── docs/deploy.md
├── src/
│   ├── main.jsx
│   ├── App.jsx              # main SPA — upload, results, chat, history, mobile nav
│   ├── ZoneEditor.jsx       # manual zone editing
│   └── styles.css
└── server/
    ├── index.js             # Express routes, multer upload, static SPA
    ├── ollama.js            # vision + chat prompts, JSON normalization
    ├── db.js                # SQLite schema
    ├── storage.js           # file paths, uploads
    └── env.js               # PORT, OLLAMA_* env
```

**Key API routes** (`server/index.js`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/photo-checks` | Upload image + run AI analysis |
| GET | `/api/photo-checks` | History list |
| GET | `/api/photo-checks/:id` | Check detail |
| GET | `/api/photo-checks/:id/image` | Image file |
| PATCH | `/api/photo-checks/:id/zones` | Save manual zones |
| GET | `/api/photo-checks/:id/chat` | Chat history |
| POST | `/api/photo-checks/:id/chat` | Send chat message |
| POST | `/api/photo-checks/:id/feedback` | User feedback |
| GET | `/health` | Health + config |
| GET | `/*` | SPA (requires `npm run build`) |

---

## Exact checklist (10 flows)

| # | Flow | Verification steps | Pass criteria |
|---|------|-------------------|---------------|
| 1 | **Local run** | `npm install && npm run dev` | Server on :3002, Vite client loads, no startup errors |
| 2 | **Production health** | `curl -s https://vitrina.sma-assistants.ru/health \| jq` | `status: ok`, `spa: true` |
| 3 | **Photo upload** | Upload JPEG/PNG from UI or `curl -F image=@file.jpg /api/photo-checks` | Returns check id; image in `uploads/` |
| 4 | **AI analysis** | Ollama running with `qwen2.5vl:7b` | `parsedResult` with status, fillRate, zones; UI shows result |
| 5 | **Visual zones** | Open check after analysis | Zone overlay aligned with image; colors/labels visible |
| 6 | **Manual zone edit** | Open ZoneEditor, draw/move zones, save | `PATCH zones` persists; reload shows saved zones |
| 7 | **Inspection chat** | Ask «где нарушение?», «почему критично?» | POST chat returns contextual reply using check data |
| 8 | **Report / history** | Complete 2+ checks; open History tab | List shows checks; tap opens detail with image + result |
| 9 | **Mobile view** | DevTools ≤768px or phone | Bottom nav works; zone editor mobile panels usable |
| 10 | **Deploy procedure** | Follow `docs/deploy.md` locally | `npm run build` → `npm start`; `/` returns 200 HTML; health ok |

---

## Commands

```bash
# Local setup
cd ~/projects/ai-photo-lab
node -v    # expect v22.x
cp .env.example .env   # if missing
npm install

# Dev (server + vite)
npm run dev

# Production-like local
npm run build
npm start

# Health
curl -s http://127.0.0.1:3002/health | jq
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/

# Production health
curl -s https://vitrina.sma-assistants.ru/health | jq

# Ollama
ollama pull qwen2.5vl:7b
curl -s "$OLLAMA_BASE_URL/api/tags"

# PM2 (production — Owner approval required)
pm2 start server/index.js --name ai-photo-lab --cwd /opt/ai-photo-lab
pm2 logs ai-photo-lab --lines 50
```

**Environment variables** (see `docs/deploy.md`):

| Variable | Default |
|----------|---------|
| `PORT` | `3002` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_VISION_MODEL` | `qwen2.5vl:7b` |

---

## Constraints

1. Work **only** in `~/projects/ai-photo-lab`.
2. **No production deploy** to `/opt/ai-photo-lab` without explicit Owner approval.
3. Preserve flow: upload → analysis → zones → chat → history.
4. No new npm dependencies unless required for a blocker — document rationale.
5. No ServiceManager / multi-tenant coupling.
6. Avoid large refactors unless a checklist item is blocked.

---

## Acceptance criteria

- [ ] All 10 checklist flows pass locally with Ollama running.
- [ ] `npm run build` succeeds; `npm start` serves SPA (GET `/` → 200 HTML).
- [ ] `GET /health` → `status: ok`, `spa: true`, `visionModel` set.
- [ ] End-to-end: upload → analysis → zones → manual edit → chat → history.
- [ ] Mobile: bottom nav + ZoneEditor mobile panels at ≤768px.
- [ ] No regressions: onboarding, settings, examples, feedback.
- [ ] If prod env issues found (Ollama unreachable), document fix — do not deploy silently.

---

## Expected response format (Codex)

Return markdown with these sections:

### Summary
2–4 sentences: what was stabilized and MVP readiness.

### Checklist results
| Flow | Status | Notes | Evidence |
|------|--------|-------|----------|
| Local run | pass/fail | … | … |
| … | … | … | … |

### Changed files
- `path/to/file` — one-line rationale

### Commands run
```
# commands with exit codes
```

### Blockers / follow-ups
Items still failing, env risks, Owner decisions.

### Production deploy recommendation
**go** | **no-go** — with pre-deploy checklist if go.

---

## AI Company reference

- Handoff id: `handoff-apl-002-stabilize-mvp`
- Template: `tpl-codex-apl-stabilize-mvp`
- Domain builder: `apps/ai-company/src/domain/projects/aiPhotoLabCodexHandoff002.ts`
- Control room checklist: `apps/ai-company/src/domain/projects/aiPhotoLabControlRoom.ts`
