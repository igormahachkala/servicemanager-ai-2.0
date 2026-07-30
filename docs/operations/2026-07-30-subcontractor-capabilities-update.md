# ServiceManager.AI — Subcontractor Capabilities Update — 2026-07-30

Status: Added to current update scope  
Priority: High  
Release condition: Must pass independent review and Stage Product Acceptance

## 1. Add Now In Current Update

### Subcontractor Ticket Creation

- Allow subcontractor users to create tickets.
- Allow creation only for locations available to the subcontractor.
- Allow creation only for equipment available to the subcontractor.
- Support ticket creation from inspection, scheduled maintenance and discovered fault scenarios.
- Support description, priority, category, photos and equipment selection.
- Store the real creator user and creator company.
- Do not substitute the client company when creator company data is missing.

### Immediate Self-Assignment

- Allow the creator to assign a newly created ticket to themselves when they are an eligible executor.
- Allow subcontractor MASTER or ADMIN to assign the ticket to an eligible employee of their own company.
- Apply the same assignment access check to the UI, candidate list and direct API request.
- Block inactive, deleted, foreign-company and out-of-scope users.
- Respect `UserAccessScope` and location bindings.

### Full Ticket Execution Cycle

Subcontractor users with the required permissions must be able to:

- create a ticket;
- accept or take the ticket into work;
- assign themselves or an eligible company employee;
- start work;
- add comments;
- attach before and after photos;
- record performed work;
- change allowed statuses;
- complete work;
- send the ticket for customer acceptance;
- see the final acceptance result.

### Subcontractor Analytics

Add a full analytics view limited to the subcontractor's own permitted data.

Required indicators:

- tickets created;
- tickets assigned;
- tickets in progress;
- tickets completed;
- tickets overdue;
- tickets returned for correction;
- average response time;
- average completion time;
- SLA compliance;
- tickets by location;
- tickets by employee;
- tickets by category;
- tickets by priority;
- tickets by status;
- planned versus emergency work;
- repeat faults;
- problematic equipment;
- workload by employee;
- completed work for a selected period.

Analytics access rules:

- subcontractor sees only their own company data;
- subcontractor sees only permitted locations and equipment;
- subcontractor cannot see another provider's employees or statistics;
- direct analytics API requests must enforce the same data scope;
- exports, if available, must use the same scope.

## 2. Required Roles And Permissions

The implementation must define explicit permissions for:

- creating a ticket;
- creating a ticket for an available location;
- assigning a ticket to self;
- assigning a ticket to another employee of the same subcontractor;
- starting and completing work;
- sending work for acceptance;
- viewing company analytics;
- viewing employee analytics;
- viewing location analytics;
- exporting analytics.

Expected role behavior:

- subcontractor ADMIN: manages company users, assignment and analytics;
- subcontractor MASTER: creates, assigns, controls execution and views operational analytics;
- subcontractor TECHNICIAN: creates tickets, takes eligible tickets, executes work and sees personal or permitted operational data.

Permissions must be authoritative on the backend.

## 3. Acceptance Scenarios For The Current Update

The update is not complete until all scenarios pass.

1. Subcontractor technician creates a ticket for an allowed location.
2. Subcontractor technician cannot create a ticket for a forbidden location.
3. Subcontractor technician creates a ticket for allowed equipment.
4. Subcontractor technician immediately assigns the ticket to themselves.
5. Ineligible technician cannot self-assign.
6. Subcontractor MASTER assigns the ticket to an eligible employee of the same company.
7. Foreign provider employee cannot be assigned.
8. Inactive or deleted employee cannot be assigned.
9. Subcontractor completes the full ticket lifecycle.
10. Customer receives the ticket for acceptance.
11. Creator and executor company identities display correctly.
12. Subcontractor analytics includes only permitted company data.
13. Cross-tenant analytics request is denied.
14. Restricted-empty access fails closed.
15. Selected-locations access with no valid binding fails closed.
16. Mobile and desktop flows behave consistently.
17. Direct API attempts cannot bypass UI restrictions.

## 4. Not Implemented Now — Add To Product Plan

### Inspection And Maintenance Module

- inspection routes;
- configurable checklists;
- scheduled inspection tasks;
- maintenance plans;
- recurring preventive maintenance;
- automatic ticket creation from failed checklist items;
- inspection completion report;
- inspection history by location and equipment.

### Materials And Costs

- materials used per ticket;
- quantity and unit;
- material cost;
- work cost;
- receipt or invoice attachment;
- approval of additional costs;
- subcontractor cost analytics;
- customer-facing cost summary.

### Work Planning

- subcontractor work calendar;
- planned maintenance calendar;
- employee workload by day and week;
- overdue maintenance;
- recurring work templates;
- replacement and reassignment planning.

### Automated Customer Reports

- before and after photos;
- discovered fault;
- completed work;
- executor and company;
- time spent;
- used materials;
- final status;
- PDF or printable completion report.

### Extended Analytics

- employee efficiency trends;
- location reliability rating;
- equipment failure frequency;
- repeat-fault rate;
- first-time-fix rate;
- workload forecast;
- maintenance cost trends;
- SLA trends;
- comparison between locations;
- comparison between employees;
- customer acceptance and return rate.

### Notifications

- new ticket;
- assignment;
- reassignment;
- upcoming SLA breach;
- overdue ticket;
- customer comment;
- returned ticket;
- accepted ticket;
- rejected acceptance;
- scheduled maintenance reminder.

### Subcontractor Company Workspace

- employee management;
- role management;
- location access management;
- employee workload view;
- internal operational dashboard;
- company settings;
- notification settings;
- report templates.

## 5. Scope Protection

The current update must not silently expand access.

Mandatory rules:

- no tenant-wide access from missing binding rows when explicit scope exists;
- no client-company substitution for subcontractor identity;
- no assignment to foreign provider employees;
- no analytics outside the subcontractor's data scope;
- no UI-only authorization;
- no production deployment before review and Stage acceptance;
- no unrelated feature work in the same implementation branch.

## 6. Current Delivery Order

1. Finish independent review of the existing hotfix integration.
2. Freeze the reviewed commit.
3. Create a separate implementation branch for subcontractor capabilities.
4. Implement ticket creation and self-assignment.
5. Implement full execution lifecycle permissions.
6. Implement subcontractor analytics.
7. Add backend security and regression tests.
8. Perform independent review.
9. Deploy to Stage.
10. Run the listed acceptance scenarios.
11. Fix only confirmed defects.
12. Prepare Production release only after full PASS.

## 7. Definition Of Done

This update is complete only when a subcontractor can:

- create a ticket for an allowed location or equipment;
- immediately assign it to themselves when eligible;
- assign it to an eligible employee of their company;
- execute the full workflow;
- send the result to the customer for acceptance;
- view complete analytics for their permitted company scope;
- do all of the above without seeing or changing foreign-company data.
