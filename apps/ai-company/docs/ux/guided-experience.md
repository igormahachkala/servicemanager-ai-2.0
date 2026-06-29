# Guided User Experience

Onboarding cards and term tooltips so a new Owner understands each main screen without external docs.

## Page guide card

Shown below the page header on:

| Screen | `pageId` | Learn more link |
|--------|----------|-----------------|
| Command Center | `commandCenter` | Operating Day |
| Run Task | `runTask` | Live Runtime |
| Runtime Live | `runtimeLive` | Runtime Settings |
| Task Results | `taskResults` | Reports |
| Employee Workspace | `workspace` | Presence |
| Operating Day | `operatingDay` | Command Center |
| AI Photo Lab Kickoff | `kickoff` | Control Room |
| Control Room | `controlRoom` | Kickoff |

Each card includes:

- **Title** — what this screen is
- **Description** — why it exists
- **Next step** — concrete action to take now
- **Learn more** — internal route to a related screen
- **Key terms** — chips with ⓘ tooltips

## Term tooltips

| Term | Used on |
|------|---------|
| Runtime | Command Center, Run Task, Live, Workspace, Operating Day |
| Workspace | Command Center, Workspace, Operating Day, Control Room |
| Handoff | Kickoff, Control Room |
| Approval | Most owner-facing screens |
| Memory Evolution | Task Results |
| Prompt | Run Task, Live Runtime |
| Model Router | Run Task |

## Module layout

```
components/guided/
  PageGuideCard.tsx
  TermTooltip.tsx
domain/guided/guidedExperience.ts  — pageId / termId maps
styles/guided-experience.css
i18n guidedExperience (en / ru)
```

No new business logic — presentation and copy only.
