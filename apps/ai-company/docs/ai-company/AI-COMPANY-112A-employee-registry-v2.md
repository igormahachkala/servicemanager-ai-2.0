# AI-COMPANY-112A — Employee Registry V2

## Goal

Единый реестр цифровых сотрудников AI Company. MAX — не единственный сотрудник.

## Domain

`src/domain/employeeRegistry/`

### Models

| Type | Purpose |
|------|---------|
| `EmployeeProfile` | Full registry record |
| `EmployeeRole` | title + department |
| `EmployeeStatus` | active, available, busy, offline, planned, onboarding |
| `EmployeeSkill` | id, label, level |
| `EmployeeCapability` | id, label, enabled |
| `EmployeeAvailability` | active, limited, placeholder, inactive |
| `EmployeeExperienceProfile` | summary, yearsEquivalent, focusAreas |

### Profile fields

`employeeId`, `displayName`, `title`, `department`, `avatar`, `status`, `skills`, `capabilities`, `currentWorkload`, `preferredTools`, `managerId`, `reportsTo`, `experienceProfile`, `availability`, `rosterSlotId`

## Seed employees

| ID | Name | Title | Availability |
|----|------|-------|--------------|
| `ag-max` | MAX | AI Development Manager | active |
| `ag-builder` | Builder | Software Engineer | placeholder |
| `ag-cto` | Atlas | Solution Architect | limited |
| `ag-qa` | Sentinel | QA & Reliability Engineer | placeholder |

## API

```typescript
listEmployees()
getEmployee(employeeId)
updateEmployeeStatus(employeeId, status)
listEmployeeCapabilities(employeeId?)
```

Status overrides persist in localStorage (`ai-company-employee-registry`). Seed profiles are code-defined.

Live `currentWorkload` computed for `availability === 'active'` from Work Queue, Worker Loop, Presence.

## Mobile integration

`/mobile/employees` roster reads from `listRegistryRosterEmployees()` via `useMobileEmployeesRoster`.

Cards show title, department, workload % from registry.

## Manual check

```bash
npm --prefix apps/ai-company run build
```

Open `/mobile/employees` — 4 cards with updated titles.

## Constraints

- No backend
- No Runtime / Worker Loop changes

## Next steps

- Enable Builder / Atlas / Sentinel mobile control pages
- Hire flow writes to registry
- Desktop Employees page reads registry
- Custom employees merge into registry
