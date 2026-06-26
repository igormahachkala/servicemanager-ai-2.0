# Product Principles

> **Status:** Governance · Product constitution  
> **Task:** AI-COMPANY-063  
> **Parent:** [North Star](../../apps/ai-company/docs/north-star/north-star.md) · [Core Principles (vision)](../../apps/ai-company/docs/vision/core-principles.md)

These eleven principles are the **product layer** of AI Company governance. They complement the seventeen architectural principles in vision docs. When in conflict, **North Star wins**, then this document, then feature specs.

---

## Principle index

| # | Principle | One line |
|---|-----------|----------|
| P1 | Product First | Build the OS, not features that undermine it |
| P2 | Owner First | The human Owner is the primary user |
| P3 | Living Company | The org must feel alive in the UI |
| P4 | Human First | Last decision is always human |
| P5 | Observable AI | All meaningful AI work is visible |
| P6 | No Hidden Work | No silent side effects |
| P7 | Digital Employees are Personalities | Colleagues with identity, not model sessions |
| P8 | LLM is Replaceable | Model is runtime, not employee |
| P9 | Platform before Company | L1 capability enables L2 tenants |
| P10 | Company before Project | Org context precedes delivery context |
| P11 | Project before Task | Delivery scope precedes ticket granularity |

---

## P1 — Product First

We choose what strengthens **AI Company as a product category** (Operating System for Digital Organizations) over local convenience.

- Prefer engines reused across customer companies.  
- Reject features that only make sense for one demo tenant unless they prove a platform pattern.  
- Every epic links to [Master Roadmap](../roadmap/master-roadmap.md) phase.

**Test:** Would this still make sense as a marketplace template?

---

## P2 — Owner First

Primary persona: **Owner** of the digital organization (Igor in V1; any customer Owner in cloud).

- Information architecture starts from Owner questions, not agent capabilities.  
- Command Center > agent settings.  
- Permissions default to **Owner gate** for irreversible actions.

**Test:** Does this help Owner decide or merely help an agent run?

---

## P3 — Living Company

The company is **never a static snapshot**.

- Presence, execution, timeline, canvas pulse.  
- “Who is working” is always one click away.  
- Completed work leaves artifacts (reports, events), not void.

**Test:** If all agents stopped, would the UI still tell a story of what happened today?

---

## P4 — Human First

Aligns with North Star pillar **Human First**.

- AI proposes; Owner approves at strategic gates.  
- No silent production deploy, permission elevation, or data deletion.  
- Accountability stays human.

**Test:** Can Owner explain who authorized this action?

---

## P5 — Observable AI

AI work must be **inspectable** in product UI:

- Runs with pipeline steps  
- Tool executions with status  
- Reports with evidence  
- Timeline events  

**Test:** Can Owner replay what the employee did without reading server logs?

---

## P6 — No Hidden Work

Forbidden:

- background tasks with no Event  
- state changes with no audit  
- “the agent already fixed it” with no Report  

Every meaningful action → **Event** (+ Report when outcome matters).

**Test:** Does timeline show this action tomorrow?

---

## P7 — Digital Employees are Personalities

An Employee has **codename**, role, voice, memory, reputation — persisted across sessions.

- UI shows **Atlas**, **MAX**, **Sentinel** — not “GPT-4 session”.  
- Conversations attach to Employee entity.  
- Career, learning, competencies apply to Employee ID.

**Test:** Would replacing the model tonight change who this colleague *is*?

---

## P8 — LLM is Replaceable

Model provider is **infrastructure** (Runtime), not identity.

- Model Router selects engine per policy.  
- Employee DNA unchanged when model changes.  
- No feature may hard-code vendor as employee name.

**Test:** Does this code break if we swap Ollama for cloud API?

---

## P9 — Platform before Company

Two-level architecture (see [platform-vs-company.md](../../apps/ai-company/docs/north-star/platform-vs-company.md)):

| L1 Platform | L2 Customer Company |
|-------------|---------------------|
| Marketplace, billing, templates | Departments, projects, employees |
| Tool registry, model catalog | Runtime usage, reports |
| Global analytics | Tenant data |

Build L1 hooks (companyId, template IDs) even in V1 mock.

**Test:** Does this leak one tenant into another?

---

## P10 — Company before Project

Owner orients at **company** level first:

- Command Center → Company Canvas → Projects  
- Employee roster is company-wide  
- Permissions and presence are company-scoped unless explicitly workspace overlay  

**Test:** Can Owner see company health without opening a project?

---

## P11 — Project before Task

Tasks sit **inside** project delivery context:

- Control Room before task list  
- Sprint goal before ticket grid  
- Task without project/home is exception, not default  

**Test:** Does this task screen explain *why* this work matters to the project?

---

## Using principles in review

Map to [Product Review Board](../product/product-review-board.md) **North Star Alignment** score.

Agents: if implementation violates any principle → **STOP** per [AGENTS.md](../../apps/ai-company/docs/AGENTS.md).

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Eleven product principles (AI-COMPANY-063) |
