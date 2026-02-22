# AUTO ASSIGN STRATEGY — ServiceManager.AI

Цель: назначать подходящего техника автоматически или предлагать кандидатов диспетчеру.

---

## MVP (Current)

Input:
- problemCategoryId -> linked specializationIds
- list of technicians -> linked specializations
- company.autoAssignEnabled flag

Algorithm (MVP deterministic):
1) candidates = technicians who have any matching specializationIds
2) if autoAssignEnabled AND candidates not empty:
   - assign first candidate (stable order)
   - status = ASSIGNED
3) else:
   - status = NEW
4) return:
   - ticket
   - instructions (from ProblemCategory)
   - candidates list
   - autoAssigned boolean

---

## Next improvements (Phase 2)

### Candidate scoring
Score = sum of weights:
- specialization match count
- workload (less assigned tickets -> higher)
- last assigned time (least recently assigned -> higher)

### Workload definition
- active tickets: status IN_PROGRESS + ASSIGNED
- optional: NEW not counted

---

## Uber-level strategy (Phase 3+)

### Inputs
- location geo (lat/lng)
- technician current location (optional)
- schedule availability
- skills
- workload
- SLA urgency
- travel time estimate

### Target function
Minimize:
- travel time
- SLA breach probability
- technician overload

Maximize:
- technician utilization
- response speed

---

## Modes

1) Auto-assign OFF:
- dispatcher manually assigns from candidates list

2) Auto-assign ON:
- auto picks best score technician

3) Hybrid (recommended):
- auto assigns, but dispatcher can override

---

## Edge cases

- No candidates:
  - ticket remains NEW
  - candidates empty
  - dispatcher must pick any technician manually (future: allow “fallback group”)

- Multiple specializations:
  - technician can match many categories
  - prefer strongest match OR balanced load

- Parent/Child:
  - child ticket can be auto-assigned separately
  - optionally inherit same technician as parent (toggle feature later)
