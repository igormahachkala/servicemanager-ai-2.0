# CODEX_INSTRUCTIONS.md

## Project
ServiceManager.AI is an enterprise multi-tenant SaaS platform for service operations.
The platform is evolving from FSM Core into a Service Network Platform.

Current priority:
- pilot-ready release
- mobile-first quick workflows
- very fast request intake for clients
- very fast execution flow for technicians
- stable operational web version for internal users

## Core product priorities
1. Client Quick Request
2. Technician Quick Execution
3. Dispatcher Fast Control
4. Photos before and after work
5. Location-based tickets
6. Notifications
7. Deterministic built-in domain AI based on templates and rules
8. Inspection / walkthrough templates
9. Maintenance procedures
10. Multiple photos per checklist item

## Architecture invariants
- companyId is a strict invariant everywhere
- backend flow: Controller -> Guard -> Policy -> Service -> Domain Events -> Prisma
- business logic only in service layer
- controllers must stay thin
- do not move business logic into controllers
- do not bypass tenant isolation
- role model is temporary; long-term direction is capability + scope + relationship
- major operational changes should remain visible through timeline / domain events

## Delivery model
ChatGPT is the architect:
- defines task
- defines target behavior
- defines file-level plan
- defines constraints
- defines checks
- reviews result

Codex is the implementer:
- reads repository
- identifies relevant files
- proposes implementation plan
- edits files
- shows diff
- runs checks
- reports risks / follow-ups

## Working rules
- first inspect relevant files
- then propose a brief plan
- then edit code
- then show diff
- then run checks
- do not refactor unrelated areas without a strong reason
- preserve existing behavior outside task scope
- prefer small, focused, composable files
- if a file grows too large, propose decomposition

## File size rules
- preferred size for new/refactored files: 300-400 lines
- files above 500 lines are candidates for decomposition
- avoid giant mixed-responsibility files

## Runtime rules
- Docker-first, but local WSL backend is a first-class dev mode
- backend local WSL runtime uses `backend/.env`
- backend docker runtime uses `backend/.env.docker`
- never switch `DATABASE_URL` manually inside the same env file
- local WSL backend must use `localhost:5432`
- docker backend must use `postgres:5432`
- local WSL backend must use `localhost:3001`
- docker backend must use `localhost:3000`
- local and docker backend are expected to run side by side without port conflict
- normal WSL dev shells must resolve to Node 20 by default
- validate both modes when changing backend env handling
- project root: `~/projects/sma-service`

## Current product direction
### Client Quick Request
Goal: create a request in about 4 clicks:
1. open quick request
2. choose location
3. choose category
4. attach photo and send

Client should not type long descriptions.
System should auto-fill as much as possible:
- company
- user
- phone
- city
- address
- point
- base description
- specialization hint
- urgency hint

### Technician Quick Execution
Goal: technician should operate through fast actions:
- receive notification
- open assigned/new ticket
- accept / claim
- on the way
- on site
- start work
- complete
- upload result photo

Technician should not be forced into long text reporting for basic cases.

### Built-in domain AI
Do not use external LLM APIs by default.
Prefer deterministic domain logic based on:
- categories
- templates
- hints
- causes
- checklists
- specialization mapping

This AI layer should support:
- auto-generated client-facing ticket description
- technician hints
- possible causes
- execution checklist
- routing hints

## Standard response format
Always answer in this structure:

### Files
List relevant files

### Plan
Short implementation plan

### Changes made
Describe changes by file

### Checks run
List executed verification commands

### Result
State what now works

### Risks / follow-ups
Anything not ideal, deferred, or needing next step

## Important constraints
- do not invent nonexistent APIs if repository already has patterns
- prefer existing project conventions over generic framework habits
- keep mobile-first UX in mind for pilot-critical flows
- do not turn quick request into a long form
- do not break current ticket lifecycle unless task explicitly changes it
- preserve upload/photo support and improve it carefully
