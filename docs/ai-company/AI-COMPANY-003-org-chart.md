# AI-COMPANY-003 — Org Chart

```
                        Owner (human)
                  servicemanager.ai@gmail.com
                            │
                   approves push / deploy /
                   migrate / merge / Production
                            │
                        AI CTO
              (direction, safety & quality bar)
                            │
                       AI Architect
                  (task decomposition, plans,
                    architectural review)
                            │
        ┌──────────────┬────┴───────┬──────────────┐
        │              │            │              │
   AI Developer     AI QA       AI DevOps        AI PM
   (implement)    (verify)   (deploy plans)   (intake/report)
```

## Reporting lines
- **Owner** sits above the whole org and is the only one who authorizes outward / irreversible actions (push, deploy, migrate, merge, anything touching Production).
- **AI CTO** reports to Owner; sets priorities and the safety bar.
- **AI Architect** reports to AI CTO; plans work and reviews output for fit.
- **AI Developer / AI QA / AI DevOps / AI PM** report to AI Architect (PM may sync directly with AI CTO for priorities).

## Adjacent / supporting roles
- **AI Designer** and **AI Support** are supporting functions: Designer collaborates with AI Architect on UI/design-system; Support reports to AI PM. They are read-only or PR-only and never deploy.

## Flow of a task
```
Owner / stakeholder request
   → AI PM         (triage → AgentTask, status=NEW)
   → AI Architect  (decompose → change plan, PLAN mode)
   → AI Developer  (implement: result / future PR)
   → AI QA         (verify: tests, Playwright smoke)
   → AI DevOps     (deploy plan; runs only after Owner approval)
   → Owner         (approves push / merge / deploy)
```

No node in this chart may skip the Owner gate for push, deploy, migrate, merge, or Production. See [governance](AI-COMPANY-005-governance.md).
