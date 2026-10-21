# DESKTOP CONSOLE V2 ARCHITECTURE - ServiceManager.AI

Status: Master Architecture  
Task: SMA-DESKTOP-001  
Scope: desktop management console only  
Non-goals: implementation, code changes, UI changes

---

# 1. Purpose

Desktop Console V2 should turn the current desktop app from a set of flat pages into one coherent management console.

The current desktop experience works functionally, but it is organized as independent pages that each expose too much at once. Users move through long vertical pages, repeated context selectors, inline edit forms, and dense cards. V2 should preserve the existing domain model while changing the information architecture.

V2 should make the console feel like an operations workspace:

- primary work in the center
- context and filters on the left/top
- detail and editing in drawers
- analytics and secondary configuration behind drilldowns
- fewer standalone pages
- fewer always-visible forms

---

# 2. Current Desktop App Summary

Current desktop routes include:

- `/board`
- `/tickets`
- `/tickets/new`
- `/tickets/:id`
- `/archive`
- `/employees`
- `/locations`
- `/problem-categories`
- `/specializations`
- `/companies`
- `/service-contracts`
- `/analytics`
- `/analytics/locations`
- `/settings`
- `/company`
- `/map`
- `/inspection/templates`
- `/inspection/runs`
- `/platform/permissions`

Tenant users land on `/board`. Platform admins land on `/companies`.

There is no dedicated desktop dashboard route. The board currently acts as dashboard, work queue, context selector, lightweight analytics surface, and kanban.

## 2.1 Master Architecture Decisions

These decisions resolve the open navigation and ownership contradictions. They are the baseline for Desktop Console V2.

- Dashboard becomes the default landing surface for tenant operators. Board no longer carries dashboard responsibility.
- Operations owns daily ticket execution.
- Board is the status workflow view for active tickets.
- Tickets is the canonical registry for all tickets. It must remain in primary navigation and become a searchable, filterable table/list. It should not disappear.
- Archive is not a primary screen. Archived tickets are exposed as the `Archived` saved filter inside Tickets. The `/archive` route may remain only for compatibility or redirect.
- Service Network owns cross-company relationships, provider/client relationships, observer mode, admins, and contracts.
- Contracts do not remain a primary left-navigation item. Contracts live under Service Network company detail, with optional filtered contract views inside the Companies workspace.
- Settings owns tenant operational configuration: company profile, operation rules, public intake, roles and permissions, notifications, and local app settings.
- Company detail in Service Network may show a read-only settings summary and links to Settings, but it does not own tenant settings.
- Directory owns reusable operational objects: locations, equipment under locations, employees, categories, and specializations.
- There is one global navigation context model. Provider/client scope, observer mode, tenant scope, saved filters, and selected object context must not be reimplemented per page.

---

# 3. Biggest UX Problems

1. Flat navigation exposes too many peer-level destinations.
   The sidebar lists operational work, dictionaries, settings, analytics, map, inspections, and hidden/platform modules in one menu. The topbar duplicates several of those links. Users must understand the whole product structure before choosing where to go.

2. Board is overloaded before the kanban appears.
   Provider/client context, observer mode, stats, quick analytics, pagination, service filters, bulk actions, empty states, and warnings all appear before the core work surface.

3. Ticket detail is a vertical stack of every possible feature.
   Summary, lifecycle hint, acceptance, technician action bar, generic actions, submit-to-acceptance form, edit form, child-ticket form, assignment, photo upload, comments, details, attachments, child tickets, chat, and timeline are stacked in one page.

4. Admin pages mix create forms with browse/edit lists.
   Employees, locations, categories, specializations, companies, and service contracts use persistent create panels next to lists. Editing often expands inline, making the list longer and harder to scan.

5. Context selection is repeated across pages.
   Provider linked-client selection and platform observer mode appear separately on board, analytics, company, locations, and ticket pages. V2 needs one persistent context switcher.

6. Cards do too much.
   Cards are used as layout containers, list rows, editable forms, settings panels, and nested subpanels. This creates heavy pages and weak hierarchy.

7. Important objects are not hierarchical.
   Locations, equipment, categories, specializations, companies, contracts, tickets, and analytics are presented mostly as flat lists, even though the domain is naturally hierarchical.

---

# 4. Scroll Problems

Highest-scroll screens:

- Ticket page: too many independent panels stacked vertically.
- Board: users scroll through context/stats/filter/bulk panels before and after horizontal kanban scrolling.
- Company page: profile, operations settings, public intake, QR tools, and service network share one page.
- Companies page: platform creation, first admin, QR tooling, company cards, admin cards, observer actions, and impersonation are combined.
- Employees page: create form plus employee list plus inline edit forms plus location binding blocks.
- Locations page: create form plus endless location cards plus inline edit forms.
- Categories page: create form plus category cards plus inline specialization matrix per category.
- Create ticket page: quick/full modes still expose long form sections, photo upload, and state-specific blocking messages.
- Analytics and location analytics: summary cards, filters, list rows, and expandable details stack vertically.

V2 should reduce page scroll by moving create/edit/detail flows to drawers and making the main page a concise list, tree, board, or dashboard.

---

# 5. Endless Lists

Pages that currently become endless as data grows:

- Board columns: ticket cards inside status columns.
- Archive: closed/canceled ticket cards.
- Employees: employee cards.
- Locations: location cards.
- Categories: category cards with embedded specialization controls.
- Specializations: specialization cards.
- Companies: company cards with nested admin cards and public intake controls.
- Analytics by location: location rows.
- Inspection runs: run cards.
- Service contracts: contract rows/cards.

V2 should use virtualized or paginated tables/lists for large collections, with details in a drawer or side panel.

---

# 6. Screens That Should Become Hierarchical

Locations should become:

`Client / Region / City / Location / Equipment / Tickets`

Employees should become:

`Role / Team or responsibility / Employee / Specializations / Location scope`

Categories should become:

`Category group / Category / Specializations / Instructions`

Companies should become:

`Company type / Company / Contracts / Admins / Public intake / Settings links`

Tickets should become:

`Queue / Status / Ticket / Activity / Attachments / Child tickets`

Analytics should become:

`Overview / SLA / Workload / Locations / Public intake / Technician performance`

Settings should become:

`Organization / Operations / Public intake / Permissions / Notifications / Local app`

---

# 7. Overloaded Cards

Most overloaded cards:

- Board ticket cards
  - They carry title, service context, status, assignee, urgency, SLA, selection state, and quick actions.
  - V2: compact card for scanning, detail drawer for actions.

- Company cards
  - They contain company identity, platform actions, public intake actions, QR actions, admin list, observer, and impersonation.
  - V2: company table/tree plus detail panel tabs.

- Category cards
  - They contain category identity, instructions, active state, delete/toggle actions, linked specialization names, all specialization checkboxes, save/reset actions.
  - V2: taxonomy list plus category detail drawer; specialization mapping as matrix/tree.

- Employee cards
  - They contain identity, metadata, status actions, delete/restore, inline edit form, specializations, and location bindings.
  - V2: employee list row plus profile drawer.

- Ticket detail panels
  - The page is not one overloaded card but a chain of many cards with similar weight.
  - V2: pinned ticket header, primary action rail, detail tabs, and activity timeline.

---

# 8. Drawer / Expand / Tree Model

Use drawers for:

- create ticket
- ticket detail opened from board
- edit ticket
- assign technician
- employee create/edit
- location create/edit
- company create/edit
- company admin creation
- public QR tools
- service contract create/edit
- notification/browser settings

Use expandable rows for:

- analytics by location
- ticket child work items
- SLA drilldowns
- public intake breakdowns
- company admins inside company detail
- employee location scope preview

Use trees for:

- left navigation groups
- location hierarchy
- category/specialization taxonomy
- company/service-network relationships
- analytics drilldown navigation

Do not use inline expansion for long forms inside endless lists. Expand rows should reveal summaries and read-only drilldowns; editing belongs in drawers.

---

# 9. Navigation Map

Desktop Console V2 should use this primary navigation:

```text
Console
+ Dashboard
  + Today
  + SLA risk
  + Unassigned tickets
  + Workload
+ Operations
  + Board
  + Tickets
  + Inspections
+ Service Network
  + Companies
+ Directory
  + Locations
  + Employees
  + Categories
+ Analytics
  + Overview
  + SLA
  + Locations
  + Workforce
  + Public intake
+ Settings
  + Company profile
  + Operations rules
  + Public intake
  + Roles and permissions
  + Notifications
  + Local app
```

Role-specific visibility:

- Tenant operators: Dashboard, Operations, Directory, Analytics, Settings.
- Technicians: Dashboard/Operations filtered to their scope, with fewer admin sections.
- Clients: Dashboard/Operations focused on own tickets and acceptance.
- Platform admins: Service Network first, with observer context available globally.

Navigation ownership notes:

- Archive appears as a saved filter inside Tickets, not as a sidebar item.
- Contracts appear inside Service Network company detail, not as a sidebar item.
- Equipment appears inside the Locations hierarchy, not as a sidebar item.
- Client/provider distinctions are filters and company types inside Service Network, not separate primary destinations.
- Settings is the only primary destination for tenant configuration.

---

# 10. Screen Hierarchy

## Dashboard

Purpose:
single executive/dispatcher landing surface.

Primary content:

- today count
- open backlog
- SLA breaches and at-risk tickets
- unassigned tickets
- urgent tickets
- workload exceptions
- public intake volume

Interactions:

- clicking a metric filters Operations/Tickets
- clicking an exception opens a ticket drawer
- provider/platform context selector is global, not per-card

## Operations

Operations should contain the daily work queue.

Recommended structure:

- Board: kanban/status workflow
- Tickets: searchable table/list for all tickets
- Archive: filter inside Tickets, not separate primary page
- Inspections: grouped under Operations, not peer-level primary nav

Board should become the active workflow view. Ticket detail should open in a drawer by default, with a full-page route still available for deep links.

Tickets should stop being a duplicate route to Board. It is the canonical registry/table view and must remain in primary navigation once V2 navigation is adopted.

## Ticket Detail

Recommended hierarchy:

- pinned header: ticket number, status, SLA, assignee, context
- primary action area: next best action only
- tabs:
  - Overview
  - Activity
  - Photos
  - Work report
  - Assignment
  - Child work
  - System details

Default view should show:

- problem summary
- location/equipment
- requester
- current status
- next action
- latest comments/photos

Move raw timeline payloads and extra IDs into System details.

## Directory

Directory should be object management:

- Locations as a tree with equipment below each location.
- Employees as a searchable table with profile drawer.
- Categories and specializations as one taxonomy/matching screen.

Create forms should not be permanently visible. Use Create buttons that open drawers.

## Service Network

Platform and provider/client relationships should live here.

Companies should be a master-detail screen:

- left or table: companies
- detail tabs: Overview, Admins, Public intake, Contracts, Observer, Settings summary

Service contracts should merge into company detail and Service Network. Contracts are not a top-level primary navigation item. The Settings summary tab links to the canonical Settings hub for tenant-owned configuration.

## Analytics

Analytics should be a drilldown workspace:

- Overview dashboard
- SLA drilldown
- Location drilldown
- Workforce drilldown
- Public intake drilldown

Location analytics should be a tab or drilldown inside Analytics, not a standalone nav item.

## Settings

Settings should absorb:

- company profile
- Company page operational settings
- public intake settings
- notification settings
- role/permissions entry
- local app/dev settings

The current Settings page should not remain in its V1 form because it mostly contains local browser settings and links elsewhere. The `/settings` route should become the V2 Settings hub and remain the canonical owner of tenant operational configuration.

---

# 11. Information Hierarchy

Every desktop screen should follow this structure:

1. Context bar
   - current company/client/provider scope
   - role/observer/provider mode
   - global search
   - create action

2. Page header
   - page title
   - 1-line purpose
   - primary action only

3. Work surface
   - board, table, tree, dashboard, or detail tabs

4. Detail surface
   - drawer, split panel, or expanded row

5. Secondary actions
   - hidden in menus or detail drawers

6. System/debug information
   - bottom tab or details section only

Rules:

- Do not show create forms by default.
- Do not show edit forms inside list rows.
- Do not repeat context selectors per page.
- Do not duplicate navigation between sidebar and topbar.
- Do not put all actions on every card.
- Keep operational next action visible; push rare actions into drawer menus.
- Default screens to overview, exceptions, and current work. Large histories, logs, and raw system payloads belong behind tabs or filters.
- Use tables for large registries, boards for active workflow, trees for nested operational objects, and drawers for object detail/editing.
- Every list/table/tree must have search, filters, empty state, loading state, and a clear active scope.
- Bulk actions belong in registries and tables, not on individual cards.
- Drawer headers must show object identity, tenant/provider/client context, status, and unsaved-change state.
- Role-specific screens should default to the role's daily work and hide unrelated administration instead of merely pushing it lower on the page.
- Dashboard content must be exception-led. It should not become another page of all metrics.

---

# 12. Left Navigation Rebuild

Current problems:

- single flat menu
- topbar duplicates important sidebar links
- operational and configuration objects are mixed
- `/board` and `/tickets` are ambiguous
- create actions are primary nav items
- map and inspection are peer-level even though they are secondary operational views

V2 left navigation:

- collapsible width
- grouped by user intent
- no topbar duplicate nav
- stable order
- role-aware visibility
- active section with nested item highlight
- global context switcher above content, not inside every page

Recommended left nav:

```text
Dashboard

Operations
- Board
- Tickets
- Inspections

Service Network
- Companies

Directory
- Locations
- Employees
- Categories

Analytics
- Overview
- SLA
- Locations
- Workforce

Settings
- Company profile
- Operations rules
- Public intake
- Roles and permissions
- Notifications
- Local app
```

Create actions should move to a global `Create` button:

- New ticket
- New employee
- New location
- New category
- New company
- New inspection

Create Contract is available from Service Network company detail, where the company/client/provider context is already known.

---

# 13. Screens That Should Disappear Or Lose Primary Navigation

These should disappear, be rebuilt, or lose standalone primary behavior:

- `/tickets`
  - Current behavior duplicates Board. V2 keeps the route and nav item, but rebuilds it as the canonical ticket registry.

- `/tickets/new`
  - Replace primary nav item with global Create Ticket drawer. Keep route only for deep links.

- `/archive`
  - Merge into Tickets as saved filter `Archived`.

- `/settings`
  - Keep the route as the V2 Settings hub. Remove only the V1 local-settings-only experience from primary use.

- `/specializations`
  - Merge with Categories into Category & Skills taxonomy.

- `/analytics/locations`
  - Merge as a drilldown tab inside Analytics.

- `/map`
  - Merge into Locations or Analytics as a map view.

- `/service-contracts`
  - Merge into Service Network / Companies detail.

Do not necessarily delete routes immediately. First remove them from primary navigation and keep redirects/deep-link compatibility.

---

# 14. Screens That Should Merge

Merge:

- Board + Dashboard summary
  - Dashboard owns summary; Board owns workflow.

- Board + Tickets
  - Board is status workflow; Tickets is table registry. They remain separate views under Operations with shared filters and detail drawers.

- Archive + Tickets
  - Archive is a filter/state, not a top-level app section.

- Employees + employee location bindings + employee specializations
  - One Employee profile drawer.

- Locations + Map + Equipment
  - One location hierarchy with table/tree/map modes.

- Categories + Specializations
  - One matching taxonomy workspace.

- Company + Settings + public intake
  - Tenant-owned configuration moves to Settings. Service Network company detail can link to those settings but does not own them.

- Companies + Service Contracts
  - One Service Network workspace.

- Analytics + Location Analytics
  - One Analytics workspace with drilldowns.

---

# 15. Recommended Expansion Model By Screen

| Area | Current pattern | V2 pattern |
| --- | --- | --- |
| Board ticket | Card with many facts/actions | Compact card + ticket drawer |
| Ticket page | Long vertical stack | Header + tabs + drawers for actions |
| Employees | Card list + inline edit | Table/list + profile drawer |
| Locations | Card list + inline edit | Location tree/table + edit drawer |
| Categories | Card list + inline checkboxes | Taxonomy tree + mapping panel |
| Companies | Giant cards with nested actions | Master-detail + tabs |
| Analytics | Static panels + list cards | Dashboard + drilldown tabs |
| Settings | Separate local/dev page | Settings hub with sections |
| Create ticket | Standalone form page | Global create drawer/wizard |

---

# 16. Implementation Roadmap

Phase 1 - Navigation and IA skeleton:

- Define V2 route groups without changing business behavior.
- Remove duplicate topbar navigation.
- Add grouped sidebar model.
- Add global context switcher for tenant/provider/platform observer scope.
- Define URL/deep-link rules for section, saved filter, selected object, and open drawer.
- Define role-aware nav visibility and hidden/disabled action rules.
- Keep existing pages mounted under old routes for compatibility.

Phase 2 - Operations shell:

- Create Dashboard route.
- Split Board summary/context panels from the kanban.
- Add compact ticket drawer from Board.
- Turn `/tickets` into the canonical ticket registry table/list.
- Move Archive into Tickets filters.
- Add saved views for active, unassigned, urgent, at-risk, archived, and my tickets.

Phase 3 - Ticket detail V2:

- Reorganize ticket page into header, primary action, and tabs.
- Move edit, assignment, acceptance, and child-ticket forms into drawers.
- Move raw timeline payloads to System details.
- Keep existing ticket route for deep links.

Phase 4 - Directory V2:

- Employees table/list with profile drawer.
- Locations tree/table with location drawer.
- Merge categories and specializations into taxonomy/matching screen.
- Remove always-visible create panels.

Phase 5 - Service Network V2:

- Companies master-detail.
- Merge service contracts into company/network detail.
- Remove Contracts from primary left navigation.
- Move QR/public intake tools into company detail tabs/drawers.
- Keep platform observer/impersonation actions but reduce card density.

Phase 6 - Analytics V2:

- Consolidate analytics and location analytics.
- Add drilldown tabs for SLA, locations, workforce, and public intake.
- Make dashboard metrics link into filtered analytics and ticket registry.

Phase 7 - Settings V2:

- Merge Company and Settings into one settings hub.
- Add sections for operations rules, public intake, permissions, notifications, and local app.
- Keep `/settings` as the canonical Settings hub route.
- Link from Service Network company detail to Settings when tenant-owned configuration is needed.

Phase 8 - Enterprise hardening:

- Add shared saved views, audit visibility, export controls, and role/permission review surfaces.
- Add accessibility, keyboard navigation, loading, empty, error, and unsaved-change standards.
- Validate large data behavior for tickets, employees, locations, and analytics before broad rollout.

---

# 17. Persona Workflows

## Dispatcher

Daily path:

- Land on Dashboard.
- Review unassigned, urgent, and SLA-risk queues.
- Open Board for active dispatch flow.
- Open ticket drawers from Board or Tickets.
- Assign technicians, update status, request acceptance, and add comments without leaving Operations.

Friction removed:

- No repeated provider/client selectors.
- No long ticket pages for routine assignment.
- No separate Archive screen for closed work.
- No inline admin forms in the daily dispatch path.

## Manager

Daily path:

- Land on Dashboard or Analytics depending on role preference.
- Review backlog, SLA risk, workload exceptions, public intake volume, and technician performance.
- Drill from metrics into filtered Tickets or Analytics.
- Open employee, location, category, or company detail only when an exception needs configuration.

Friction removed:

- Analytics and location analytics are one workspace.
- Dashboard is exception-led, not a duplicate board.
- Saved filters replace repeated manual filtering.
- Settings and Service Network have clear ownership boundaries.

## Owner

Daily path:

- Land on Dashboard.
- Review business health, SLA exposure, urgent work, public intake, and workload exceptions.
- Use Analytics for trend review.
- Use Settings for tenant configuration.
- Use Service Network only when company/provider/client relationships or contracts need attention.

Friction removed:

- Company operational settings are not split across Company, Settings, and Companies pages.
- Contracts are found inside the relevant company context.
- Dashboard separates owner-level health from dispatcher workflow.

## Technician (Desktop)

Daily path:

- Land on Dashboard filtered to assigned work.
- Use Operations/Tickets saved filter `My tickets`.
- Open ticket detail drawer or full ticket page for work report, photos, comments, and status updates.
- Use Directory only if role permits viewing locations or equipment needed for the ticket.

Friction removed:

- Admin sections are hidden unless permitted.
- Ticket detail defaults to current work and next action.
- System details, raw timeline, and management controls are secondary.

## Client

Daily path:

- Land on Dashboard filtered to own company/location scope.
- Review open, waiting acceptance, rejected, urgent, and closed ticket filters.
- Open tickets to comment, upload attachments, request updates, accept, or reject work.
- Use Settings only for client-owned profile or notification preferences if permitted.

Friction removed:

- Provider-only operations are hidden.
- Acceptance work is visible without reading the full internal timeline.
- Client scope is persistent and visible in the context bar.

---

# 18. Navigation Context Model

V2 navigation context is:

`Workspace / Actor role / Operational scope / Section / View or saved filter / Selected object / Drawer state`

Context rules:

- Workspace is the desktop console.
- Actor role determines visible sections, permitted actions, default landing page, and default saved views.
- Operational scope contains tenant, provider/client relationship, platform observer mode, selected company, and selected location where relevant.
- Section is the primary nav group: Dashboard, Operations, Service Network, Directory, Analytics, or Settings.
- View or saved filter is the local working set, such as Board status, Tickets archived, Tickets my tickets, Analytics SLA, or Locations map.
- Selected object is optional and may be ticket, company, employee, location, category, contract, or inspection.
- Drawer state is optional and may represent create, edit, assign, acceptance, notification settings, or detail preview.

Navigation behavior:

- The context bar shows current tenant/provider/client/platform observer scope on every screen.
- Breadcrumbs show section, view, and selected object when the user is deeper than a primary screen.
- URL state should support deep links to primary screen, saved filter, selected object, and open drawer when safe.
- Closing a drawer returns the user to the same list, board, tree, saved filter, scroll position, and selected context.
- Hidden actions are used when the user has no permission. Disabled actions are used only when the user has permission but the object state blocks the action.
- Cross-context navigation must ask for confirmation if there are unsaved changes in a drawer or form.

---

# 19. Scalability Requirements

| Scale | Required behavior |
| --- | --- |
| 10 tickets | Board and Tickets both remain usable with default filters and no special paging burden. |
| 100 tickets | Board remains useful for active work; Tickets registry must provide search, saved filters, sort, and quick open drawer. |
| 1,000 tickets | Tickets registry becomes primary for search and historical work; board columns must be capped, paginated, or virtualized by active filters. |
| 10,000 tickets | Registry requires server-side pagination, indexed search/filtering, saved views, async exports, and archive-aware defaults. Board should show only active/recent/status-limited work. |
| 100 employees | Employee table with filters by role, status, specialization, and location scope is sufficient. |
| 1,000 employees | Employee management requires server-side search, pagination, bulk operations, import/export, and permission-aware profile drawers. |
| 500 locations | Location tree requires lazy loading, search, map clustering, region/city grouping, and equipment loading only after a location is selected. |

Scalability rules:

- No endless unpaginated cards for tickets, employees, locations, categories, companies, contracts, or analytics rows.
- Analytics must aggregate server-side and drill down on demand.
- Saved filters must have stable URLs and be shareable where permissions allow.
- Large exports must run asynchronously or with clear progress and limits.
- Board performance must be protected by default active-work filters.

---

# 20. Enterprise Requirements

Enterprise customers will need these requirements before broad V2 adoption:

- SSO/SAML and enterprise identity provider support.
- SCIM or equivalent user lifecycle provisioning.
- Role-based and permission-based access control with auditable role changes.
- Audit logs for ticket changes, settings changes, impersonation/observer mode, exports, and permission changes.
- Shared saved views for teams, with owner, visibility, and permission controls.
- Bulk import/export for employees, locations, categories, companies, contracts, and tickets where appropriate.
- Configurable SLA policies, escalation rules, business hours, holidays, and time zone behavior.
- Data retention, archive policy, privacy controls, and attachment visibility rules.
- Export governance for sensitive ticket, client, employee, and contract data.
- Accessibility baseline for keyboard navigation, focus management, contrast, and screen-reader structure.
- Localization readiness for dates, time zones, statuses, and operational labels.
- Observability for slow screens, failed loads, notification failures, and user-visible errors.
- Feature flags and phased rollout controls by tenant, role, and navigation group.
- Integration surfaces for CRM, ERP, identity, email, SMS, push notifications, and webhooks.

---

# 21. AI Integration Points Reserved

AI is not part of the V2 implementation scope. The architecture should reserve clean integration points so AI can become first-class later without changing the IA.

Reserved points:

- Ticket intake triage: category, urgency, duplicate detection, missing information, and suggested next action.
- Assignment support: technician recommendation, workload fit, location fit, specialization fit, and explanation.
- SLA risk: predicted breach risk and recommended intervention.
- Dashboard brief: daily exceptions, workload summary, and owner/manager summary.
- Natural-language search: converting user intent into saved filters for Tickets, Analytics, Employees, and Locations.
- Ticket summary: concise summaries for long activity timelines, comments, photos, and work reports.
- Client-facing cleanup: public intake normalization, title cleanup, and missing-field prompts.
- Category and specialization maintenance: suggested mappings and stale taxonomy detection.
- Location analytics: anomaly detection for repeated failures by location, asset, category, or provider.
- Workforce analytics: overload detection, skill gaps, and balancing recommendations.
- Acceptance workflow: work-report quality checks and likely rejection risk.

AI requirements:

- AI outputs must be explainable, reversible, and clearly marked as suggestions.
- AI must respect tenant isolation, role permissions, observer context, and data visibility.
- No AI action should bypass the existing audit and permission model.

---

# 22. Recommendation

GO for Desktop Console V2 as the Master Architecture.

The current app has enough domain coverage, but the desktop IA is now the main bottleneck. V2 should not begin as visual polish. It should begin with navigation, hierarchy, and interaction model changes: grouped navigation, global context, drawers for edit/create/detail, table/tree surfaces for large objects, and merged screens for duplicated concepts.

NO-GO for isolated page redesigns before the navigation and expansion model are agreed. Redesigning one page at a time will keep the same flat structure and will not fix the cross-console UX problems.
