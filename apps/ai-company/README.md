# AI Company — Local V1

Standalone frontend for AI Company. Runs **locally only** — no ServiceManager integration, no backend, mock data.

> **AI Company is an Operating System for Digital Organizations** — not a chat app, not a bag of agents, not a workflow builder, and not a CRM.

## AI Company Constitution

The **North Star** is the supreme source of truth for all product, architecture, and agent work.

| Document | Purpose |
|----------|---------|
| **[docs/north-star/north-star.md](./docs/north-star/north-star.md)** | **Platform constitution — read first** |
| [docs/north-star/digital-dna.md](./docs/north-star/digital-dna.md) | Digital DNA — identity across model changes |
| [docs/north-star/platform-vs-company.md](./docs/north-star/platform-vs-company.md) | Platform L1 vs Customer Company L2 |
| [docs/north-star/employee-lifecycle.md](./docs/north-star/employee-lifecycle.md) | Template → hire → career → retirement |
| [docs/north-star/marketplace-vision.md](./docs/north-star/marketplace-vision.md) | Marketplace sells templates, not LLMs |
| [docs/north-star/living-company.md](./docs/north-star/living-company.md) | Living organization principle |
| [docs/north-star/roadmap-2030.md](./docs/north-star/roadmap-2030.md) | Long-range platform phases |

**Rule:** If implementation contradicts North Star — **change the implementation**. If a task conflicts with North Star — **stop and ask the Owner**.

## AI Company Source of Truth

Before changing this project, read the mandatory agent entrypoint and vision docs:

| Document | Purpose |
|----------|---------|
| **[docs/AGENTS.md](./docs/AGENTS.md)** | **Required reading for all agents** — rules, scope, conflict policy |
| [docs/vision/README.md](./docs/vision/README.md) | Vision index (subordinate to North Star) |
| [docs/vision/ai-company-vision.md](./docs/vision/ai-company-vision.md) | Product vision |
| [docs/vision/core-principles.md](./docs/vision/core-principles.md) | 17 core principles |
| [docs/vision/digital-employee-model.md](./docs/vision/digital-employee-model.md) | Digital employee anatomy |
| [docs/vision/human-control-and-reporting.md](./docs/vision/human-control-and-reporting.md) | Human control & reports-first |
| [docs/vision/tools-mcp-and-access-model.md](./docs/vision/tools-mcp-and-access-model.md) | Tools, MCP, permissions |
| [docs/vision/model-independence-and-experience.md](./docs/vision/model-independence-and-experience.md) | Model Router & experience |
| [docs/vision/communication-model.md](./docs/vision/communication-model.md) | Unified communication |
| [docs/architecture/adr-001-ai-company-platform.md](./docs/architecture/adr-001-ai-company-platform.md) | Platform ADR |
| [docs/architecture/adr-002-tool-registry.md](./docs/architecture/adr-002-tool-registry.md) | Tool Registry ADR |
| [docs/domain/domain-model.md](./docs/domain/domain-model.md) | Domain model |

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
| `/ops/canvas` | **Company Canvas** — living operational graph |
| `/ops/organization` | Organization / squads |
| `/ops/workspaces` | Workspaces — project containers |
| `/ops/workspaces/new` | Create workspace |
| `/ops/workspaces/:id` | Workspace detail + assignments |
| `/ops/employees` | Employee roster |
| `/ops/employees/:id` | Employee profile |
| `/ops/execution` | Execution queue |
| `/ops/chats` | Unified chats |
| `/ops/tasks` | Tasks |
| `/ops/tools` | AI Tools Registry |

## V1 roster

**Active:** AI CTO, MAX Senior Developer

**Planned:** AI Architect, AI QA, AI DevOps, AI Assistant, AI CEO, AI CFO, AI COO

## Structure

```
apps/ai-company/
├── docs/
│   ├── AGENTS.md              # Agent entrypoint (read first)
│   ├── north-star/            # Platform constitution
│   ├── vision/                # Product vision & principles
│   ├── architecture/          # ADRs
│   └── domain/                # Entity specs
└── src/
    ├── layout/                # App shell + top navigation
    ├── flow-workspace/        # Flow canvas + Employee Inspector
    ├── components/canvas/     # Company Canvas (living org graph)
    ├── mission-control/       # NOC pages + localStorage data
    └── App.tsx                # Root router
```

## Boundaries

- Do not import from `web/src/**` or ServiceManager API
- Changes only under `apps/ai-company/**`
- Deploy / domain integration is a future phase
- Preserve [North Star](./docs/north-star/north-star.md) and [core principles](./docs/vision/core-principles.md) in all changes
