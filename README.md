# ServiceManager.AI

ServiceManager.AI is a service operations platform for client companies and provider companies. It manages service contracts, tickets, assignment, field execution, completion, client acceptance, audit history, attachments, and notifications across the management web app and the mobile technician flow.

## Start Here

The root README is the only repository entry point for developer onboarding.

Start here:

[docs/00_START_HERE.md](docs/00_START_HERE.md)

That document contains the canonical 00-05 reading sequence. Read that sequence before coding.

## Repository Shape

- `backend/` - NestJS API, Prisma data access, authorization, ticket workflow, service contracts, notifications, uploads, and integrations.
- `web/` - React and Vite management platform plus mobile web interface.
- `agent-runner/` - supporting automation runner package.
- `docs/` - canonical onboarding, architecture, operations, and reference documentation.
- `scripts/` - repository utility scripts.
- `test/` - shared test infrastructure.
- `docker-compose.yml` and `docker-compose.stage.yml` - container orchestration definitions.

Do not use root sidecar notes, generated artifacts, or legacy documents as onboarding entry points.
