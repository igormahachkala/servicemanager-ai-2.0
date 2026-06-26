# AI Company — North Star

> **Status:** Platform Constitution · **Supreme Source of Truth**  
> **Scope:** All work on `apps/ai-company/**` and all future AI Company platform decisions  
> **Authority:** If implementation contradicts this document, **implementation must change** — not the North Star.

---

## One sentence

**AI Company is an Operating System for Digital Organizations.**

It is **not** a chat app, a bag of agents, a workflow builder, or a CRM.

---

## What we are building

AI Company gives a **human Owner** a real digital organization:

- persistent **digital employees** with identity and career;
- **workspaces** and **projects** where delivery happens;
- **runtime**, **tools**, and **knowledge** as workplace infrastructure;
- **communication**, **tasks**, **runs**, **reports**, and **approvals** as observable work;
- **audit**, **analytics**, and **human gates** so automation stays accountable.

The product must feel like a **living company**, not a prompt panel.

---

## Constitutional pillars

| Pillar | Document |
|--------|----------|
| Digital identity & DNA | [digital-dna.md](./digital-dna.md) |
| Platform vs customer company | [platform-vs-company.md](./platform-vs-company.md) |
| Employee lifecycle | [employee-lifecycle.md](./employee-lifecycle.md) |
| Marketplace & templates | [marketplace-vision.md](./marketplace-vision.md) |
| Living company UX | [living-company.md](./living-company.md) |
| Long-range direction | [roadmap-2030.md](./roadmap-2030.md) |

Supporting law (must remain consistent with North Star):

| Layer | Entry |
|-------|-------|
| Vision detail | [../vision/README.md](../vision/README.md) |
| Architecture | [../architecture/adr-001-ai-company-platform.md](../architecture/adr-001-ai-company-platform.md), [../architecture/adr-002-tool-registry.md](../architecture/adr-002-tool-registry.md) |
| Domain | [../domain/domain-model.md](../domain/domain-model.md) |
| Agent rules | [../AGENTS.md](../AGENTS.md) |

---

## Non‑negotiable truths

### 1. Digital Employee is a digital person

A **Digital Employee** is a persistent organizational identity.

- The **LLM is not the employee**.
- The **LLM is only a thinking engine** — one replaceable part of Runtime.
- Identity, memory, experience, reputation, relationships, and career live in **Digital DNA**, not in model weights.

See [digital-dna.md](./digital-dna.md) and [../vision/digital-employee-model.md](../vision/digital-employee-model.md).

### 2. Two-level architecture

| Level | Name | Owns |
|-------|------|------|
| **L1** | **AI Company Platform** | Marketplace, templates, billing, licensing, updates, model catalog, tool registry, analytics |
| **L2** | **Customer Company** | Departments, projects, workspaces, employees, runtime usage, reports, knowledge |

Platform sells **capability and templates**. Customer company **operates** the living organization.

See [platform-vs-company.md](./platform-vs-company.md).

### 3. Marketplace sells employees, not models

Marketplace offers **Employee Templates** — curated starting DNA, skills, tools, and workflows.

Customer journey:

**Template → Hire → Company Employee → Learning → Experience → Career → Promotion → Retirement**

Models are infrastructure. Templates are product.

See [marketplace-vision.md](./marketplace-vision.md).

### 4. Living company

The interface must show **work in motion**: who is working, discussing, waiting, reviewing, running tools, producing reports.

Owner **observes** and **decides** at critical gates.

See [living-company.md](./living-company.md).

### 5. Human First

The **last decision is always human**.

| AI may | AI must not (without human gate) |
|--------|----------------------------------|
| Recommend | Own irreversible production decisions |
| Analyze | Override Owner intent silently |
| Execute approved work | Assume accountability |
| Document & report | Replace human responsibility |

Accountability stays with the **Owner**.

See [../vision/human-control-and-reporting.md](../vision/human-control-and-reporting.md).

---

## Explicit non-goals

AI Company is **not**:

- a generic chatbot or “talk to GPT” shell;
- an n8n-style workflow builder as the product core;
- a CRM or ticket system repurposed as org chart;
- a single-model assistant tied to one vendor;
- a disposable agent runner with no persistent identity.

Workflows, chats, and automations may exist **inside** the operating system — they are not the operating system.

---

## Conflict resolution (mandatory)

For every task — human or agent:

1. Read this document and linked constitution set.
2. Compare the requested change against North Star.
3. If aligned → proceed.
4. If **conflict** → **STOP**. Do not continue implementation.
5. Report conflict to **Owner** with: task summary, violated principle, compliant alternatives.

No silent drift. No “temporary” violations.

---

## Success criteria

We succeed when an Owner can answer in one glance:

- **Who** is working?
- **On what** project or workspace?
- **What** is moving through tasks, runtime, approvals?
- **Where** are reports and risks?
- **Which tools** are in use?
- **What** requires my decision?

And when every digital employee feels like a **colleague with history** — not a fresh chat session.

---

## Revision

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-24 | North Star constitution established (AI-COMPANY-048) |
