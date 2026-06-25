# AI Company — Local V1

Standalone frontend for AI Company. Runs **locally only** — no ServiceManager integration, no backend, mock data.

> **AI Company is an operating system for a digital organization** — not a chatbot, not a prompt launcher, and not only an agent runner.

## AI Company Source of Truth

Before changing this project, read the mandatory agent entrypoint and vision docs:

| Document | Purpose |
|----------|---------|
| **[docs/AGENTS.md](./docs/AGENTS.md)** | **Required reading for all agents** — rules, scope, conflict policy |
| [docs/vision/ai-company-vision.md](./docs/vision/ai-company-vision.md) | Product vision |
| [docs/vision/core-principles.md](./docs/vision/core-principles.md) | 17 core principles |
| [docs/vision/digital-employee-model.md](./docs/vision/digital-employee-model.md) | Digital employee anatomy |
| [docs/vision/human-control-and-reporting.md](./docs/vision/human-control-and-reporting.md) | Human control & reports-first |
| [docs/vision/tools-mcp-and-access-model.md](./docs/vision/tools-mcp-and-access-model.md) | Tools, MCP, permissions |
| [docs/vision/model-independence-and-experience.md](./docs/vision/model-independence-and-experience.md) | Model Router & experience |
| [docs/vision/communication-model.md](./docs/vision/communication-model.md) | Unified communication |
| [docs/architecture/adr-001-ai-company-platform.md](./docs/architecture/adr-001-ai-company-platform.md) | Platform ADR |
| [docs/domain/domain-model.md](./docs/domain/domain-model.md) | Domain model |

**Rule:** If a task conflicts with these documents, stop and ask for clarification.

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
| `/ops/organization` | Organization / squads |
| `/ops/workspaces` | Workspaces — project containers |
| `/ops/workspaces/new` | Create workspace |
| `/ops/workspaces/:id` | Workspace detail + assignments |
| `/ops/employees` | Employee roster |
| `/ops/employees/:id` | Employee profile |
| `/ops/employees/:id/conversation` | Direct conversation |
| `/ops/discussions` | Group discussions |
| `/ops/tasks` | Tasks |
| `/ops/feed` | Activity feed |
| `/ops/tools` | AI Tools Registry |

## V1 roster

**Active:** AI CTO, MAX Senior Developer

**Planned:** AI Architect, AI QA, AI DevOps, AI Assistant, AI CEO, AI CFO, AI COO

## Structure

```
apps/ai-company/
├── docs/
│   ├── AGENTS.md              # Agent entrypoint (read first)
│   ├── vision/                # Product vision & principles
│   ├── architecture/          # ADRs
│   └── domain/                # Entity specs
└── src/
    ├── layout/                # App shell + top navigation
    ├── flow-workspace/        # Flow canvas + Employee Inspector
    ├── mission-control/       # NOC pages + localStorage data
    └── App.tsx                # Root router
```

## Boundaries

- Do not import from `web/src/**` or ServiceManager API
- Changes only under `apps/ai-company/**`
- Deploy / domain integration is a future phase
- Preserve [core principles](./docs/vision/core-principles.md) in all changes
