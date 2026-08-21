# 00 Start Here

This is the canonical developer entry point for ServiceManager.AI.

## Onboarding Goal

A new developer should understand the product, the current architecture, the access model, the repository structure, and the safe development workflow before changing code.

Read documents in this order:

1. 00 - [Start Here](00_START_HERE.md)
2. 01 - [Project Overview](01_PROJECT_OVERVIEW.md)
3. 02 - [Architecture](02_ARCHITECTURE.md)
4. 03 - [Access Model](03_ACCESS_MODEL.md)
5. 04 - [Development Workflow](04_DEVELOPMENT_WORKFLOW.md)
6. 05 - [Testing And First Task](05_TESTING_AND_FIRST_TASK.md)

Then start coding.

## Reference Reading

These are not part of the onboarding path. Read them when a task needs them.

| Document | Use it when |
|---|---|
| 06 - [Domain Model](06_DOMAIN_MODEL.md) | you need the entities and their relationships |
| 07 - [Ticket Lifecycle](07_TICKET_LIFECYCLE.md) | you are changing statuses or transitions |
| 08 - [Permissions Matrix](08_PERMISSIONS_MATRIX.md) | you need to know whether a role may do something |
| 11 - [Runtime Acceptance](11_RUNTIME_ACCEPTANCE.md) | you are verifying a candidate on Stage |
| 12 - [Release Process](12_RELEASE_PROCESS.md) | you are assembling or shipping a release |
| 13 - [Troubleshooting](13_TROUBLESHOOTING.md) | something fails and you need the likely layer |
| 14 - [Glossary](14_GLOSSARY.md) | a term in these documents is unfamiliar |

Start with 13 when you are debugging: it orders the checks environment-first, which is
where most reported defects actually live.

## Source Of Truth

The numbered documents are the onboarding source of truth. They describe the accepted current project model and point to the files developers should inspect first.

Backend code remains the implementation source of truth. If any non-numbered reference conflicts with the numbered path or the current code, verify the implementation before changing behavior.

## Legacy Documents

Historical architecture notes, audit reports, operations records, and earlier planning files are preserved under `docs/LEGACY/` when they are no longer safe as active developer guidance.

Use legacy material only for historical context. Do not treat it as current architecture.

## First Local Checks

From the repository root:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
```

For backend work:

```bash
cd backend
npm run prisma:generate
npm run build
npm test
```

For frontend work:

```bash
cd web
npm run build
```

Never commit secrets, credential-bearing environment files, generated archives, local caches, or runtime uploads.
