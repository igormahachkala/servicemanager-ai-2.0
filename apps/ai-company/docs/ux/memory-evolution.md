# Employee Memory Evolution (AI-COMPANY-071)

## Flow

```
Runtime completion
  → Report (findings / risks / recommendations)
  → extract lessons (findings, mistakes, improvements, knowledge)
  → save Employee Memory + Project Knowledge + Experience
  → emit memory.evolved event
```

## Data sources (no LLM)

| Source | Extracted as |
|--------|----------------|
| `Report.findings` | finding → memory + knowledge |
| `Report.risks` | mistake → memory |
| `Report.recommendations` | improvement → memory (decision) |
| `RuntimeResult.warnings` | mistake → memory |
| `RuntimeResult.responseText` (≥80 chars) | knowledge → memory + knowledge item |

## Storage

- **Evolution log**: `localStorage` key `ai-company-memory-evolution`
- **Employee Memory**: via `createMemory()` — tagged `lessons-learned`, source `run`
- **Project Knowledge**: via `createKnowledgeItem()` — tagged `memory-evolution`, status `published`
- **Experience**: via `addExperienceEvent()` — type `report`, XP from lesson categories

## UI surfaces

| Screen | What owner sees |
|--------|-----------------|
| Runtime Run | Full evolution panel for completed run |
| Task Runner Result | Compact evolution after completion |
| Employee Memory page | Today learned summary |
| Employee Profile → Memory | Today learned (if any) |
| Employee Workspace | Today learned summary |
| Knowledge catalog | Items from runtime evolution |
| Timeline / Notifications | `memory.evolved` events |

## Idempotency

One evolution record per `runId` — re-opening a completed run does not duplicate memory/knowledge.

## Future

- Owner approval before publishing evolution knowledge
- Semantic deduplication across runs
- Link evolution entries to competency skill domains automatically
