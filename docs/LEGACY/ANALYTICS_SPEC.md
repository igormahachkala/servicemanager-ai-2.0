# ANALYTICS SPEC — ServiceManager.AI

Цель: обеспечить управляемость сервисной компании через метрики.

---

## 1. Core Metrics (MVP)

### Tickets volume
- Tickets per day
- Tickets per week
- Tickets per month
- Tickets per point (store/location)

### Status metrics
- NEW
- ASSIGNED
- IN_PROGRESS
- DONE
- CLOSED

### Technician metrics
- Tickets assigned per technician
- Tickets completed per technician
- Average resolution time

---

## 2. SLA Metrics

Fields used:
- createdAt
- updatedAt
- status
- slaMinutes

Metrics:
- Average response time
- Average resolution time
- SLA breaches (resolution > slaMinutes)
- % of tickets resolved within SLA

---

## 3. Urgency breakdown

- NOT_URGENT
- URGENT
- EMERGENCY (future)

Charts:
- Urgency distribution
- Urgency vs SLA compliance

---

## 4. Parent/Child analytics

- Parent ticket count
- Child tickets per parent
- Escalation ratio

---

## 5. Filters

All analytics must support:
- date range
- technician
- specialization
- problem category
- pointName
- urgency
- status

---

## 6. Future (Phase 2)

- Technician efficiency score
- Average travel time
- Geo heatmap of issues
- Repeated issue detection per location
- Monthly recurring problem report
