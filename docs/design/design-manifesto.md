# Design Manifesto

> **Status:** Supreme design constitution for AI Company  
> **Task:** AI-COMPANY-063  
> **Parent:** [North Star](../../apps/ai-company/docs/north-star/north-star.md)

This is the **main design document** for AI Company. If a screen, interaction, or visual choice contradicts this manifesto, **the design must change** — not the manifesto.

---

## One sentence

**AI Company looks and behaves like an operating system for a living digital organization — not software category cosplay.**

---

## What we are NOT designing

| Category | Why we reject it as identity |
|----------|------------------------------|
| **CRM** | We do not optimize for lead pipelines and contact records. We optimize for **organizational motion**: who works, on what, with what outcome. |
| **Admin panel** | We are not a settings graveyard with tables. Every surface answers an **operational question** for the Owner. |
| **Jira** | We do not worship ticket backlogs. Tasks are **one mode** of employee activity — not the product. |
| **Trello** | We do not reduce companies to cards on boards. We show **relationships**, **runtime**, **reports**, and **decisions**. |
| **n8n** | We do not expose wires and nodes as the hero. Automation exists **inside** the OS; the OS is people, work, and accountability. |
| **ChatGPT wrapper** | Chat is a **channel**, not the company. Employees persist without the chat window open. |

We may **borrow patterns** (lists, kanban, graphs) as **views** — never as product definition.

---

## What we ARE designing

### Operating System for Digital Organizations

The Owner runs a **company**:

- **Employees** with identity and career  
- **Workspaces** and **projects** as places work happens  
- **Runtime** and **tools** as infrastructure  
- **Execution**, **approvals**, **reports** as observable outcomes  
- **Presence**, **timeline**, **canvas** as living telemetry  

The interface should feel like **mission control**, not **form filler**.

---

## Design pillars

### 1. Owner at the center

Every primary surface answers Owner questions:

- What is happening?  
- Who is working?  
- What needs my decision?  
- Where is risk?  
- What was produced?  

Design for **observation and decision**, not for agent self-expression.

### 2. Living company

Static dashboards lie. Prefer:

- live timelines  
- presence  
- running executions  
- pipeline steps  
- streaming logs (mock or real)  

Silence is a **design bug** when work is in progress.

### 3. Human First, always visible

AI recommends; **humans decide** at critical gates. Design must show:

- pending approvals  
- audit trail links  
- report artifacts  
- who approved what  

Never hide irreversible paths behind “AI did it.”

### 4. Employees are colleagues

Use **codename**, role, presence, workspace context — not “Assistant” or model name as identity.

The LLM brand (Claude, GPT, Qwen) appears in **Runtime / model** context only.

### 5. Density with clarity

Operators want **information density** without clutter:

- strong hierarchy  
- scannable panels  
- one hero metric per tile  
- monospace for data  

Avoid consumer-app whitespace bloat and enterprise-table soup equally.

### 6. One visual system

See [Visual Language](./visual-language.md). The product must not look assembled from five startups.

---

## Surface archetypes

| Archetype | Purpose | Examples |
|-----------|---------|----------|
| **Command** | Owner orientation | Executive Command Center |
| **Control Room** | Project delivery | AI Photo Lab Control Room |
| **Queue** | Work intake & flow | Execution Queue, Approvals |
| **Workspace** | Employee day | Employee Workspace, Workday |
| **Lab** | Visual understanding | Visual Execution Lab |
| **Graph** | Relationship truth | Company Canvas |
| **Record** | Audit & history | Reports, Runs, Timeline |

New screens must declare which archetype they extend.

---

## Interaction philosophy

| Do | Don't |
|----|-------|
| Link related engines on every command surface | Stranded pages with no integration links |
| Show empty state + next action | Blank panels |
| Label mock vs real execution | Pretend mock is production |
| Use consistent primary action | Competing CTAs |
| Prefer progressive disclosure | Overwhelming single page |

---

## Copy & tone

- **Direct**, **operational**, **confident**  
- Present tense for live state (“Atlas is reviewing…”)  
- Past tense for audit (“Report created at…”)  
- No hype (“magic”, “supercharge”)  
- No anthropomorphic deception (“I feel”, “I decided”) for agents — **employees produce**, **Owner decides**

---

## Measurement

Design succeeds when:

1. New Owner orients on `/ops` in **under 30 seconds**  
2. UX checklist pass rate **≥ 90%** on primary flows  
3. [UX debt](./ux-debt.md) trend **down** quarter over quarter  
4. No new forbidden visual patterns in review  

---

## Governance links

| Document | Role |
|----------|------|
| [Product Principles](../principles/product-principles.md) | Why we build |
| [Product Review Board](../product/product-review-board.md) | What we approve |
| [UX Review Checklist](./ux-review-checklist.md) | How we verify |
| [Visual Language](./visual-language.md) | How we look |
| [UX Debt](./ux-debt.md) | What we owe |

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | Design manifesto established (AI-COMPANY-063) |
