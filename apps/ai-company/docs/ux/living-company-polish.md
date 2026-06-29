# Living Company Experience Polish (AI-COMPANY-069)

## Before

- Presence showed generic strings (`Runtime pipeline in progress`, `Waiting for Owner approval`) without pipeline step context.
- Command Center employee cards rebuilt fake presence rows — no run/task linkage, no progress.
- Runtime Live showed pipeline steps but no unified «сейчас делает…» banner tied to employee role.
- Employee Workspace listed `presence.activity` as plain text; no recent activity strip.
- Visual Lab sidebar had task/execution metadata only — no live playback step label.
- Task Results cards showed status badges without human-readable employee activity.
- Kickoff had no at-a-glance team workload from control room `workNow`.
- Canvas live nodes used static text labels without pulse indicators.

## After

- **`domain/living/livingActivity.ts`** — single resolver from runtime runs, executions, tasks, task results, and presence. Derives phase, progress (pipeline %), step id, and timestamps from existing data only.
- **`presenceEngine`** — stores richer activity labels via `presenceActivityFromLiving()` when syncing runtime runs.
- **Shared UI** — `LivingActivityLine`, `LivingProgressBar`, `LivingPulseDot`, `RecentActivityStrip` + `living-company.css` (pulse, progress, completed flash).
- **i18n** — `livingCompany` section (EN/RU) with employee verb templates (Atlas/MAX/QA/DevOps) and pipeline step labels.

### Screens improved

| Screen | Changes |
|--------|---------|
| **Command Center** | Real presence cards with living activity + progress; runtime rows with activity line; timeline live dots for events <5m; canvas preview uses `LiveIndicator` |
| **Runtime Live** | Top «Doing now» banner; pipeline panel shows living activity + progress |
| **Visual Lab** | Sidebar «Doing now» from active timeline entry / running test step |
| **Canvas** | `LiveIndicator` with pulse dot; inspector running tasks show live status |
| **Employee Workspace** | Overview «Doing now» + recent activity strip from company events |
| **Kickoff** | `KickoffTeamActivityPanel` from control room `workNow` (working + waiting approval) |
| **Task Results** | Cards show localized activity line from task result status |

## Data sources (no fake features)

- `RuntimeRun.pipeline` → step, progress, phase
- `Execution` queue → employee activity
- `DeliveryTask` → assignee focus
- `TaskResult.status` → review/waiting/completed phases
- `EmployeePresence` + `CompanyEvent` timeline
- `AiPhotoLabControlRoomSnapshot.workNow`
- `VisualLabSession.timeline` playback index
- Canvas `liveStatus` from existing canvas engine

## Future improvements

- Wire `LivingActivityLine` into employee profile presence section and Control Room preview panel rows.
- Auto-refresh living labels on a short interval when Runtime Live is open (today: updates on storage/sync events).
- Map canvas node selection to full `LivingActivitySnapshot` in inspector (not only `liveStatus` badge).
- Surface execution queue position in progress bar for queued runs.
- Add completed animation replay when run transitions to `completed` in Runtime Live stream.

## Checks

```bash
cd apps/ai-company && npm run build
```

## Expected result

Owner sees what each digital employee is doing — with human-readable verbs, progress, and timestamps — without opening extra pages. All labels come from existing runtime, execution, task, and presence data.
