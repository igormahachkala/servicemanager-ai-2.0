# Management UX Audit V1

Status: approved audit baseline for Management Platform V2.

Scope: desktop management contour only. This document does not prescribe mobile,
backend, database, Stage, or Production changes.

## 1. Current Management Structure

The desktop management application is currently organized as a set of routed
pages inside a shared shell. The shell provides a sidebar, topbar, role-aware
navigation, realtime invalidation, impersonation state, and the route outlet.
The current structure is useful as a web application, but it does not yet behave
as a persistent operations workspace.

Current route groups:

- Operations: `/board`, `/tickets`, `/archive`, `/tickets/new`, `/tickets/:id`.
- Team: `/employees`, `/users`, `/access-constructor`, `/permissions`,
  `/platform/permissions`, `/platform/access-constructor`.
- Service network: `/companies`, `/company`, `/service-contracts`,
  `/contractors`.
- Objects: `/locations`, `/objects`, `/map`, inspection routes.
- Analytics: `/analytics`, `/analytics/locations`.
- Settings: `/settings`, `/company`, catalogs and notification settings.
- Legacy/platform surfaces: IT Company and Engineering Agent remain referenced
  in the desktop navigation/routing configuration and should not be treated as
  part of the ServiceManager.AI management product.

The `/tickets` route currently renders the same `BoardPage` as `/board`.
There is no separate `TicketsPage` implementation in the current codebase.

### Operations

Primary users:

- Dispatcher.
- Master.
- Network director.
- Provider administrator.
- Client administrator for created/owned requests.
- Technician in desktop mode for assigned and claimable tickets.

Current task:

- Observe the operational queue.
- Create a ticket.
- Assign or claim work.
- Move tickets through lifecycle states.
- Open a full ticket page for detail work.

What users see first:

- A page-level board with statistics, provider/client context controls, filters,
  pagination controls, optional bulk actions, and Kanban columns.

Main issue:

- The board is the only primary working mode. It is visually useful but too
  heavy for dispatcher queue work.

### Ticket Detail

Primary users:

- Dispatcher.
- Master.
- Technician.
- Client administrator.
- Provider administrator.

Current task:

- Read ticket context.
- Change status.
- Assign or reassign technician.
- Upload photos.
- Comment.
- Review SLA and acceptance.
- Inspect timeline.

What users see first:

- A full page ticket card with many vertically stacked panels.

Main issue:

- One ticket becomes a long document. The user leaves the queue, loses the
  operational list, and must return back to continue processing.

### Employees, Users, Permissions, Access Constructor

Primary users:

- Company administrator.
- Platform administrator.
- Manager responsible for staff access.

Current task:

- Create and maintain employees.
- Bind technicians to locations.
- Configure permissions and access contours.
- Preview access through Access Constructor.

What users see first:

- Employees page with create form and list.
- Access Constructor with list and custom right-side drawer.
- Permissions matrix with raw platform-level permission model.

Main issue:

- Employee management and access configuration are split across multiple entry
  points. Access Constructor is product-facing, but the employee list does not
  yet feel like the natural starting point for access management.

### Companies, Contracts, Contractors

Primary users:

- Platform administrator.
- Provider owner or administrator.
- Company owner.

Current task:

- Manage companies.
- Configure company profile and public intake.
- Manage contracts and provider/client relationships.
- Enter observer or impersonation mode.

What users see first:

- Long company cards and company settings panels with mixed operational,
  contractual, legal, QR, and platform controls.

Main issue:

- Company, contract, public intake, and provider/client relationship management
  are not presented as a single Service Network workspace.

### Objects, Locations, Map, Inspections

Primary users:

- Manager.
- Dispatcher.
- Technician lead.
- Client administrator.

Current task:

- Maintain service points/locations.
- Filter tickets by location/equipment.
- Open map and inspections.

What users see first:

- Flat location list and create/edit forms.

Main issue:

- "Location" is already used as a real service object, but the UI does not yet
  present it as a Digital Object Passport with related tickets, equipment,
  inspections, documents, and analytics.

### Analytics, Notifications, Settings

Primary users:

- Manager.
- Owner.
- Platform administrator.

Current task:

- Review operational metrics.
- Configure company settings.
- Configure notifications.
- Access diagnostics.

What users see first:

- Separate pages and cards.

Main issue:

- Settings mixes user-facing controls with diagnostic information. Notification
  settings are fragmented between browser, mobile, and push-specific surfaces.

## 2. Main UX Problems

1. The desktop product still behaves like a website made of independent pages,
   not like a professional management workspace.

2. The dispatcher cannot work from one stable operational context. Opening a
   ticket sends the user to a full page.

3. The board is overloaded. It contains provider/client context selection,
   analytics, quick filters, pagination controls, bulk controls, Kanban columns,
   card actions, and technical hints.

4. Ticket detail is too long. Summary, SLA, acceptance, status actions,
   assignment, uploads, comments, context, photos, child tickets, chat, and
   timeline are stacked vertically.

5. Employee management is split from access management. The user has to know
   whether they need Employees, Permissions, or Access Constructor.

6. Objects are modeled in the UI as a flat location list. That prevents the
   product from scaling to many cities, objects, equipment units, inspections,
   and documents.

7. Company management is too dense. Platform actions, public intake, QR,
   legal settings, contract context, and admin management compete for attention.

8. Several screens expose internal vocabulary such as raw identifiers,
   technical role labels, platform mode names, and implementation hints.

9. Bulk actions and filters are not consistently positioned near the working
   object.

10. The next action is often unclear. Users can view data, but the UI does not
    consistently lead them to the most likely operational action.

## 3. Navigation Problems

The current sidebar is role-aware, but the information architecture is still
flat. Most tenant navigation items are placed under one generic menu section.

Primary problems:

- `/board` and `/tickets` duplicate the same operational surface.
- `/objects` and `/locations` duplicate the same surface.
- `/users` and `/employees` duplicate the same surface.
- `/permissions` and `/platform/permissions` duplicate the same surface.
- `/access-constructor` and `/platform/access-constructor` duplicate the same
  surface.
- Archive is a mode of the ticket queue, not a primary workspace.
- New ticket creation is a context action, not a permanent sidebar destination.
- Map is a view mode inside Objects, not a top-level daily destination.
- Specializations and problem categories are catalogs and should live under
  Settings or Directory.
- Stub routes such as equipment, acts, assistant, and contractors should not
  appear as primary working destinations until they are real modules.
- Legacy IT Company and Engineering Agent surfaces should not be treated as
  ServiceManager.AI product navigation.

Navigation should be rebuilt around workspace switching:

- Operations.
- Service Network.
- Objects.
- Team.
- Analytics.
- Settings.

The sidebar should answer "where am I working?" not "which CRUD page can I open?".
Within each workspace, navigation should be handled by context, view switchers,
tabs, filters, tree selection, and drawers.

## 4. Long Page Problems

Long-page debt is concentrated in the following areas:

- Board: Kanban cards show limited ticket density, and the `take` pattern can
  create very large board renders.
- Ticket detail: all ticket work is stacked on a single full page.
- Employees: create form, search, list, inline edit, and binding controls share
  the same vertical surface.
- Locations: create form, list, and inline edit produce a flat service-point
  maintenance page.
- Companies: company cards contain too many unrelated actions.
- Company settings: operational, legal, public intake, contract, and provider
  context settings are all in one page.
- Access Constructor: product direction is correct, but the page has its own
  drawer and can become heavy without a shared shell pattern.

Blocks that should become collapsible, tabbed, drawer-based, or contextual:

- Ticket comments, photos, timeline, child tickets, and acceptance history.
- Assignment candidates and smart assignment result.
- Company public intake and QR settings.
- Employee location bindings and access configuration.
- Object equipment, inspections, tickets, documents, and analytics.
- Advanced permission matrix.
- Analytics drilldowns.

Full pages should be reserved for:

- Deep links.
- Sharing.
- Long editing.
- Reports.
- Complex workflows that cannot fit inside a drawer.

## 5. Data Hierarchy Problems

The current UI exposes too many flat lists:

- Tickets appear mainly as Kanban cards.
- Employees appear as a flat list with inline editing.
- Locations appear as a flat list.
- Companies appear as long cards.
- Catalogs are separate pages instead of a coherent directory/settings area.

Target hierarchy:

- Company -> contracts -> clients/providers -> access contours.
- Company -> city -> object/location -> zone/location -> equipment -> inspections
  -> tickets -> documents/photos.
- Employee -> role -> client contours -> locations -> additional capabilities
  -> preview.
- Ticket -> object -> equipment -> assignee -> SLA -> acceptance -> activity.
- Category -> specialization -> eligible technicians -> ticket routing.

The hierarchy must be visible in the UI. Users should not need to reconstruct
relationships by opening separate pages.

## 6. Object Management Problems

The current "Locations" page is the seed of the future Objects workspace, but it
is not yet a Digital Object Passport.

Data already present or implied:

- Location/object name.
- City.
- Address.
- Platform code.
- Active/deleted state.
- Ticket location context.
- Equipment context on tickets.
- Public request link/QR entry points.
- Inspection routes.
- Location analytics.

Missing for Digital Object Passport:

- Object overview.
- Related active tickets.
- Ticket history.
- Equipment list.
- Inspection templates and runs.
- Documents and photos.
- SLA and service quality summary.
- Responsible contractor/provider.
- Bound employees or technicians.
- Public request/QR configuration.
- Object-level activity timeline.

Recommended Object Passport tabs:

- Overview.
- Tickets.
- Equipment.
- Inspections.
- Documents and photos.
- Contractors and responsible people.
- Analytics.
- Public intake and QR.
- Settings.

Manager actions that should be available from the object card:

- Create ticket for this object.
- Assign responsible technician or team.
- Start or schedule inspection.
- Open object analytics.
- Attach document/photo.
- Generate or copy public request QR link.
- Open related equipment.
- Disable/archive object when permitted.

## 7. Scaling Risks

The current UI will degrade as operational volume grows.

Ticket scale:

- 10 tickets: current board is acceptable.
- 100 tickets: board becomes slow to scan; registry is required.
- 1,000 tickets: client-side card rendering and manual `take` are risky.
- 10,000 tickets: server-side pagination, saved views, search, and virtualized
  rendering become mandatory.

Employee scale:

- 100 employees: inline cards become difficult to scan.
- 1,000 employees: registry, filters, status, role, access issue flags, and
  server-side pagination are required.

Object scale:

- 100 objects: flat list starts to lose context.
- 500 objects: tree/grouping by company and city is mandatory.
- Equipment and inspections must live inside object context to avoid another
  layer of flat pages.

Company scale:

- 100 companies: cards are too heavy.
- Platform admin needs registry, filters, company type, status, contract state,
  public intake state, and quick actions.

Permission scale:

- Raw permission matrix should remain advanced/platform tooling.
- Day-to-day administration should happen through Access Constructor and
  employee context.

Realtime scale:

- Registry rows, board columns, and drawers must update without full page reload.
- Selection, filters, scroll position, and open drawer state must be preserved
  during realtime updates.

## 8. Recommended Information Architecture

The desktop application should become a set of persistent workspaces.

### Operations Workspace

Purpose:

- Run daily ticket operations.

Primary pattern:

- Registry as the main working view.
- Board as a secondary visual view.
- Ticket drawer for fast inspection and action.
- Full ticket page only for deep links, sharing, long editing, and reports.

Core objects:

- Ticket queue.
- Ticket drawer.
- SLA and acceptance state.
- Assignment and quick actions.

### Service Network Workspace

Purpose:

- Manage companies, clients, providers, contractors, and contracts.

Primary pattern:

- Company registry.
- Company passport drawer.
- Contracts as a tab/context inside companies and relationships.
- Contractor management as a workspace module when it becomes real.

Core objects:

- Company.
- Contract.
- Provider/client relationship.
- Public intake settings.

### Objects Workspace

Purpose:

- Manage service objects and the operational reality attached to them.

Primary pattern:

- Company/city/object tree.
- Object Passport drawer.
- Map as a secondary visual view.

Core objects:

- Object/location.
- Equipment.
- Inspection.
- Ticket history.
- Documents/photos.

### Team Workspace

Purpose:

- Manage employees, roles, access, and location/client contours.

Primary pattern:

- Employee registry.
- Employee drawer.
- Access Constructor launched from employee context.
- Permission matrix as advanced platform/admin mode only.

Core objects:

- Employee.
- Role.
- Access contour.
- Location binding.
- Permission override.

### Analytics Workspace

Purpose:

- Review operational performance and drill into issues.

Primary pattern:

- Overview metrics.
- Drilldown views.
- Saved filters tied to Operations, Objects, and Team.

Core objects:

- SLA performance.
- Ticket volume.
- Employee workload.
- Object health.
- Public intake.

### Settings Workspace

Purpose:

- Configure company, notifications, catalogs, and platform settings.

Primary pattern:

- Settings groups and tabs.
- Context actions for catalogs.
- Advanced sections hidden by role.

Core objects:

- Company settings.
- Notification channels.
- Categories and specializations.
- Platform permissions.

### Pattern Rules

Registry:

- Use for tickets, employees, companies, and other high-volume entities.

Tree:

- Use for objects, locations, equipment, and nested operational geography.

Drawer:

- Use as the default way to inspect and edit a selected entity without leaving
  the workspace.

Modal:

- Use for confirmation, short create actions, and narrow decisions.

Full Page:

- Use only for deep links, sharing, long editing, reports, and complex workflows.

Inline Expand:

- Use sparingly for one-row secondary details only. Do not expand large forms
  inside long lists.

## 9. Priority Backlog

### P0 - Daily Work Blockers

#### SMA-MGMT-UX-002B - Operations Ticket Registry V1

Problem:

- Kanban/card flow is the only primary ticket workflow and does not support high
  density dispatcher work.

Expected result:

- Compact ticket registry with search, filters, sorting, SLA, assignee, quick
  actions, row selection, and Registry/Board mode switch.

Approximate scope:

- Desktop frontend operations UI.
- Reuse existing board API where safe.
- No backend change unless proven necessary.

Affected pages:

- `/board`.
- `/tickets`.

Dependencies:

- SMA-MGMT-UX-001 Fixed Management Shell.

Conflict risk with SMA-MGMT-UX-001:

- High if both tasks modify `Shell`, `BoardPage`, or shared layout CSS.

#### SMA-MGMT-UX-002C - Ticket Context Drawer V1

Problem:

- Opening a ticket takes the user away from the queue and into a long full page.

Expected result:

- Row/card click opens a ticket drawer; full page remains for deep links and
  long editing.

Approximate scope:

- Desktop ticket UI.
- Reuse existing ticket panels.
- No backend change expected.

Affected pages:

- `/tickets`.
- `/board`.
- `/tickets/:id`.

Dependencies:

- SMA-MGMT-UX-002B Registry V1.

Conflict risk with SMA-MGMT-UX-001:

- High if drawer shell or workspace scroll behavior is modified in parallel.

#### SMA-MGMT-UX-002D - Remove Primary Navigation Noise

Problem:

- Sidebar exposes too many page-level destinations and mode actions.

Expected result:

- Sidebar switches only primary workspaces. Archive, create ticket, map,
  categories, specializations, and stubs move into workspace context.

Approximate scope:

- Desktop navigation config, active state mapping, route preservation.

Affected pages:

- Shell.
- Sidebar.
- Navigation.

Dependencies:

- SMA-MGMT-UX-001 Fixed Management Shell.

Conflict risk with SMA-MGMT-UX-001:

- High because both tasks can touch navigation shell.

### P1 - Navigation and Page Structure

#### SMA-MGMT-UX-003A - Management Workspace Navigation IA

Problem:

- Routes are duplicated and the sidebar does not match managerial workflows.

Expected result:

- Operations, Service Network, Objects, Team, Analytics, and Settings become the
  primary navigation hierarchy.

Approximate scope:

- Route grouping, navigation labels, active state, no business logic changes.

Affected pages:

- Shell.
- Router.
- Navigation.

Dependencies:

- SMA-MGMT-UX-002D.

Conflict risk with SMA-MGMT-UX-001:

- Medium to high depending on shell changes.

#### SMA-MGMT-UX-003B - Employees + Access Constructor Entry Merge

Problem:

- Employee management and access configuration are separate workflows.

Expected result:

- Employee registry exposes "Configure access" as a natural employee action.
  Access Constructor remains the business-facing access workflow.

Approximate scope:

- Frontend integration with existing Access Constructor endpoints.

Affected pages:

- `/employees`.
- `/access-constructor`.
- `/permissions`.

Dependencies:

- Access Constructor stable in release.
- Employee registry direction agreed.

Conflict risk with SMA-MGMT-UX-001:

- Medium.

#### SMA-MGMT-UX-003C - Company Passport V1

Problem:

- Company, public intake, legal settings, contracts, admins, and platform
  actions compete in long company cards/pages.

Expected result:

- Company Passport with tabs and contextual actions.

Approximate scope:

- Desktop frontend company/service-network UI.

Affected pages:

- `/companies`.
- `/company`.
- `/service-contracts`.

Dependencies:

- Service Network workspace IA.

Conflict risk with SMA-MGMT-UX-001:

- Low to medium.

### P2 - Existing Management Screen Development

#### SMA-MGMT-UX-004A - Object Passport V1

Problem:

- Objects are displayed as flat locations, not operational assets.

Expected result:

- Object Passport with overview, tickets, equipment, inspections, documents,
  contractors, analytics, QR, and settings.

Approximate scope:

- Desktop frontend objects UI; backend additions may be required later for
  consolidated object data.

Affected pages:

- `/locations`.
- `/objects`.
- `/map`.
- Inspection routes.

Dependencies:

- Object hierarchy decision.

Conflict risk with SMA-MGMT-UX-001:

- Medium.

#### SMA-MGMT-UX-004B - Catalogs Consolidation

Problem:

- Categories, specializations, and inspection templates are separate CRUD pages.

Expected result:

- Catalogs live under Settings or Team/Directory with tabs and context actions.

Approximate scope:

- Frontend navigation and page grouping.

Affected pages:

- `/problem-categories`.
- `/specializations`.
- `/inspection/templates`.

Dependencies:

- Workspace navigation IA.

Conflict risk with SMA-MGMT-UX-001:

- Low.

#### SMA-MGMT-UX-004C - Notification Settings Consolidation

Problem:

- Browser notifications, mobile push, and settings are fragmented.

Expected result:

- One human-facing notification settings area with channel status and recovery
  states.

Approximate scope:

- Desktop settings and existing push/mobile settings integration.

Affected pages:

- `/settings`.
- Mobile push settings.
- Notification components.

Dependencies:

- Push release stable.

Conflict risk with SMA-MGMT-UX-001:

- Medium because settings and mobile/push code may move independently.

### P3 - Larger Product Modules

#### SMA-MGMT-UX-005A - Equipment Module

Problem:

- Equipment exists in ticket context but the equipment route is not a real
  product module.

Expected result:

- Equipment registry and equipment drawer integrated with Object Passport and
  tickets.

Approximate scope:

- New product module; likely frontend and backend.

Affected pages:

- `/equipment`.
- Objects workspace.
- Ticket context.

Dependencies:

- Object Passport V1.

Conflict risk with SMA-MGMT-UX-001:

- Low initially, higher when backend scope starts.

#### SMA-MGMT-UX-005B - Acts and Documents Workspace

Problem:

- Acts/documents are not integrated into operational ticket/object/company
  flows.

Expected result:

- Documents and acts become linked entities in ticket, object, and company
  context.

Approximate scope:

- New product module.

Affected pages:

- `/acts`.
- Ticket detail/drawer.
- Object Passport.
- Company Passport.

Dependencies:

- Document model decision.

Conflict risk with SMA-MGMT-UX-001:

- Low.

#### SMA-MGMT-UX-005C - Contractor Management Workspace

Problem:

- Contractors, service contracts, and company links are split across routes.

Expected result:

- Contractor management workspace for provider/client relationships and
  contract state.

Approximate scope:

- Frontend workspace plus possible backend refinements.

Affected pages:

- `/contractors`.
- `/service-contracts`.
- `/companies`.

Dependencies:

- Company Passport V1.

Conflict risk with SMA-MGMT-UX-001:

- Medium.

## 10. Recommended Delivery Sequence

1. SMA-MGMT-UX-001 - Fixed Management Shell.
2. SMA-MGMT-UX-002B - Operations Ticket Registry V1.
3. SMA-MGMT-UX-002C - Ticket Context Drawer V1.
4. SMA-MGMT-UX-002D - Remove Primary Navigation Noise.
5. SMA-MGMT-UX-003A - Management Workspace Navigation IA.
6. SMA-MGMT-UX-003B - Employees + Access Constructor Entry Merge.
7. SMA-MGMT-UX-003C - Company Passport V1.
8. SMA-MGMT-UX-004A - Object Passport V1.
9. Subsequent product modules:
   - SMA-MGMT-UX-004B - Catalogs Consolidation.
   - SMA-MGMT-UX-004C - Notification Settings Consolidation.
   - SMA-MGMT-UX-005A - Equipment Module.
   - SMA-MGMT-UX-005B - Acts and Documents Workspace.
   - SMA-MGMT-UX-005C - Contractor Management Workspace.
