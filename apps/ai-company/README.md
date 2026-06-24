# AI Company — Local V1

Standalone frontend for AI Company. Runs **locally only** — no ServiceManager integration, no backend, mock data.

## Quick start

```bash
cd apps/ai-company
npm install
npm run dev
```

Open **http://localhost:5174**

## Build

```bash
npm run build
npm run preview
```

## Navigation

| Route | Screen |
|-------|--------|
| `/` | **Flow** — Flow Workspace (main entry) |
| `/ops` | Mission Control dashboard |
| `/ops/organization` | Organization / org chart |
| `/ops/employees` | Employee profiles |
| `/ops/tasks` | Tasks |
| `/ops/feed` | Activity feed |
| `/ops/tools` | AI Tools Registry |

## V1 roster

**Active:** AI CTO, MAX Senior Developer

**Planned:** AI Architect, AI QA, AI DevOps, AI Assistant, AI CEO, AI CFO, AI COO

## Structure

```
src/
├── layout/           # App shell + top navigation
├── flow-workspace/   # Flow canvas + Employee Inspector
├── mission-control/  # NOC pages + mock data
└── App.tsx           # Root router
```

## Boundaries

- Do not import from `web/src/**` or ServiceManager API
- Changes only under `apps/ai-company/**`
- Deploy / domain integration is a future phase
