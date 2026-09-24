# Documentation Maintenance - ServiceManager.AI

Status: Active

Purpose: keep documentation aligned with the current product, architecture, and
repository structure.

## Source Of Truth

The active onboarding path is:

```text
README.md
-> docs/00_START_HERE.md
-> docs/01_PROJECT_OVERVIEW.md
-> docs/02_ARCHITECTURE.md
-> docs/03_ACCESS_MODEL.md
-> docs/04_DEVELOPMENT_WORKFLOW.md
-> docs/05_TESTING_AND_FIRST_TASK.md
```

Documents `06` through `17` are active references. `docs/LEGACY/` is historical
only.

## Update Rule

When code or architecture changes, update the matching documentation in the same
task or explain why no documentation change is required.

Do not leave active docs pointing to deleted, moved, or legacy-only documents.

## Active Documents

| Document | Update when |
| --- | --- |
| `README.md` | the root onboarding entry point or repository shape changes |
| `docs/00_START_HERE.md` | the onboarding order or reference list changes |
| `docs/01_PROJECT_OVERVIEW.md` | product scope, major modules, stack, or repository structure changes |
| `docs/02_ARCHITECTURE.md` | high-level architecture or system boundaries change |
| `docs/03_ACCESS_MODEL.md` | visibility, assignment, claim, request assignment, acceptance, or notification eligibility changes |
| `docs/04_DEVELOPMENT_WORKFLOW.md` | local development, Git flow, Stage, Production, or task workflow changes |
| `docs/05_TESTING_AND_FIRST_TASK.md` | first-task guidance or expected checks change |
| `docs/06_DOMAIN_MODEL.md` | entities, fields, ownership, relationships, or services change |
| `docs/07_TICKET_LIFECYCLE.md` | statuses, transitions, available actions, or lifecycle events change |
| `docs/08_PERMISSIONS_MATRIX.md` | role capabilities or permission interpretation changes |
| `docs/09_REPOSITORY_GUIDE.md` | folders, modules, entry files, or ownership boundaries change |
| `docs/10_CODING_STANDARDS.md` | project-specific engineering rules change |
| `docs/11_RUNTIME_ACCEPTANCE.md` | Stage acceptance evidence or runtime verification protocol changes |
| `docs/12_RELEASE_PROCESS.md` | release gates, backup, migration, deploy, smoke, or rollback procedure changes |
| `docs/13_TROUBLESHOOTING.md` | common failure modes or diagnostic steps change |
| `docs/14_GLOSSARY.md` | terminology changes |
| `docs/15_ARCHITECTURE_STATUS.md` | architecture freeze status or invariants change |
| `docs/16_ARCHITECTURE_CHANGELOG.md` | accepted architecture changes are integrated |
| `docs/17_DECISION_LOG.md` | a lasting architecture decision is made |

## Active Reference Documents

| Document | Update when |
| --- | --- |
| `docs/PLATFORM_CONSTITUTION_V2.md` | high-level platform invariants change |
| `docs/API_SPEC.md` | API shape, request DTOs, or response DTOs change |
| `docs/CODE_STYLE_GUIDE.md` | formatting or code style guidance changes |
| `docs/DATABASE_MIGRATION_POLICY.md` | migration rules change |
| `docs/DATA_MODEL_DIAGRAM.md` | the text ER view changes |
| `docs/DB_SCHEMA_EXPLAINED.md` | schema concepts or tables change |
| `docs/ERROR_CODE_STANDARD.md` | API error code conventions change |
| `docs/ERROR_HANDLING_POLICY.md` | backend error handling conventions change |
| `docs/OBSERVABILITY_STRATEGY.md` | logging, monitoring, or runtime evidence expectations change |
| `docs/SERVICE_BOUNDARIES.md` | service/domain boundaries change |
| `docs/process/deployment-workflow.md` | process-specific deployment notes change |
| `docs/reference/ENGINEERING_AGENT.md` | the internal Engineering Agent boundary changes |

## Legacy Documents

Move documents to `docs/LEGACY/` when they are historical, superseded, or unsafe
as active developer guidance.

Legacy documents may be useful for archaeology, but they must not be linked as
current architecture unless the link clearly labels them as legacy.

## Monthly Audit

Check:

1. local markdown links;
2. references to deleted or moved files;
3. numbering from `00` through `17`;
4. stale terminology;
5. duplicate active guidance;
6. broken GitHub links after pushes;
7. whether a new developer can onboard using only `README.md`,
   `docs/00_START_HERE.md`, and documents `01` through `17`.
