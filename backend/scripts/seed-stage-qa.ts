import {
  PrismaClient,
  CompanyType,
  ServiceContractRole,
  ServiceContractStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

/**
 * Official Stage QA seed — FRESH-RESET ONLY.
 *
 * Models the universal hierarchy that the future SubcontractorContract will formalize:
 *
 *   QA Client Co (Фудзияма)
 *     ↑ PRIMARY ServiceContract
 *   QA General Provider Co (ИП Ермаков)
 *     ↓ (future) SubcontractorContract  → QA Subcontractor Zosimov Co (ИП Зосимов)
 *     ↓ (future) SubcontractorContract  → QA Other Subcontractor Co
 *
 * ── FRESH-RESET ONLY ────────────────────────────────────────────────────────
 * Run this ONLY against a freshly reset / empty Stage database. It is NOT safe to
 * re-run against a populated DB: every row is upserted by a hard-coded UUID `id`,
 * but `User.email` (and other natural keys) are globally @unique. If the DB already
 * holds rows with these emails under different ids, the create branch fires and the
 * insert fails on the unique-email constraint. Reset the DB first, then seed.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * SubcontractorContract does NOT exist in the schema yet, so it is intentionally NOT
 * created here, and no provider-to-provider ServiceContract is created either. The
 * data below is shaped so that, once the model lands, no fixtures need to change —
 * only the General → Subcontractor contracts get added.
 *
 * Subcontractor technician scoping is pre-staged via BOTH TechnicianClientBinding
 * (provider → client[/location]) and UserLocationBinding (user → client location),
 * so runtime visibility/scoping that keys off either binding works today.
 *
 * Ticket.companyId is ALWAYS the CLIENT company (hard invariant). Cross-company
 * assignment (subcontractor technician on a client ticket) is written directly here
 * to pre-stage realistic data; the runtime assign() guards are bypassed by the seed.
 */

// ---- Stable IDs -------------------------------------------------------------
const CO = {
  client: '10000000-0000-4000-8000-000000000001',
  general: '10000000-0000-4000-8000-000000000002',
  secondary: '10000000-0000-4000-8000-000000000003',
  zosimov: '10000000-0000-4000-8000-000000000004',
  otherSub: '10000000-0000-4000-8000-000000000005',
}

const USR = {
  client: '20000000-0000-4000-8000-000000000001',
  // CLIENT-company ADMIN — for Phase 1.5 verification (ADMIN+CLIENT cannot assign).
  clientAdmin: '20000000-0000-4000-8000-000000000010',
  // CLIENT-company TERRITORIAL_MANAGER — for Phase 1.5 verification (can comment, cannot assign).
  clientTerritorialManager: '20000000-0000-4000-8000-000000000011',
  general: '20000000-0000-4000-8000-000000000002',
  secondary: '20000000-0000-4000-8000-000000000003',
  secondaryTech: '20000000-0000-4000-8000-000000000004',
  zosimovAdmin: '20000000-0000-4000-8000-000000000005',
  zosimovTech1: '20000000-0000-4000-8000-000000000006',
  zosimovTech2: '20000000-0000-4000-8000-000000000007',
  otherSubAdmin: '20000000-0000-4000-8000-000000000008',
  otherSubTech: '20000000-0000-4000-8000-000000000009',
}

const LOC = {
  zosimovBound: '30000000-0000-4000-8000-000000000001', // bound to Zosimov
  otherBound: '30000000-0000-4000-8000-000000000002', // bound to Other Subcontractor
  unrelated: '30000000-0000-4000-8000-000000000003', // not bound to any subcontractor
}

const CAT = {
  general: '40000000-0000-4000-8000-000000000001',
}

const TKT = {
  generalScope: '50000000-0000-4000-8000-000000000001', // unassigned, unrelated location
  zosimovAssigned: '50000000-0000-4000-8000-000000000002', // assigned to Zosimov tech1
  otherAssigned: '50000000-0000-4000-8000-000000000003', // assigned to Other Subcontractor tech
  zosimovLocationUnassigned: '50000000-0000-4000-8000-000000000004', // unassigned @ Zosimov location
  unrelatedUnassigned: '50000000-0000-4000-8000-000000000005', // unassigned @ unrelated location
}

const TCB = {
  zosimovTech1: '70000000-0000-4000-8000-000000000001', // Zosimov tech1 @ FJ-001
  zosimovTech2: '70000000-0000-4000-8000-000000000002', // Zosimov tech2 @ FJ-001
  otherSubTech: '70000000-0000-4000-8000-000000000003', // Other Subcontractor tech @ FJ-002
  secondaryTech: '70000000-0000-4000-8000-000000000004', // tech@test.local @ FJ-002 (Arbat)
}

async function main() {
  const passwordHash = await bcrypt.hash('StageQa123!', 10)

  // ---- Companies ------------------------------------------------------------
  const companies: Array<{ id: string; name: string; type: CompanyType }> = [
    { id: CO.client, name: 'QA Client Co', type: CompanyType.CLIENT },
    { id: CO.general, name: 'QA General Provider Co', type: CompanyType.PROVIDER },
    { id: CO.secondary, name: 'QA Secondary Provider Co', type: CompanyType.PROVIDER },
    { id: CO.zosimov, name: 'QA Subcontractor Zosimov Co', type: CompanyType.PROVIDER },
    { id: CO.otherSub, name: 'QA Other Subcontractor Co', type: CompanyType.PROVIDER },
  ]

  for (const c of companies) {
    await prisma.company.upsert({
      where: { id: c.id },
      update: { name: c.name, type: c.type },
      create: { id: c.id, name: c.name, type: c.type },
    })
  }

  // ---- Users ----------------------------------------------------------------
  const users: Array<{ id: string; email: string; role: UserRole; companyId: string; isExecutor: boolean }> = [
    { id: USR.client, email: 'client@test.local', role: UserRole.CLIENT, companyId: CO.client, isExecutor: false },
    // CLIENT-company ADMIN: can view/comment/create, but NOT assign/claim/change-status (Phase 1.5 matrix).
    { id: USR.clientAdmin, email: 'client.admin@test.local', role: UserRole.ADMIN, companyId: CO.client, isExecutor: false },
    // CLIENT-company TERRITORIAL_MANAGER: can view/comment scoped tickets, NOT assign/claim/change-status.
    { id: USR.clientTerritorialManager, email: 'territorial.manager@test.local', role: UserRole.TERRITORIAL_MANAGER, companyId: CO.client, isExecutor: false },
    { id: USR.general, email: 'provider@test.local', role: UserRole.ADMIN, companyId: CO.general, isExecutor: false },
    { id: USR.secondary, email: 'secondary.provider@test.local', role: UserRole.ADMIN, companyId: CO.secondary, isExecutor: false },
    { id: USR.secondaryTech, email: 'tech@test.local', role: UserRole.TECHNICIAN, companyId: CO.secondary, isExecutor: true },
    { id: USR.zosimovAdmin, email: 'zosimov.admin@test.local', role: UserRole.ADMIN, companyId: CO.zosimov, isExecutor: false },
    { id: USR.zosimovTech1, email: 'zosimov.tech1@test.local', role: UserRole.TECHNICIAN, companyId: CO.zosimov, isExecutor: true },
    { id: USR.zosimovTech2, email: 'zosimov.tech2@test.local', role: UserRole.TECHNICIAN, companyId: CO.zosimov, isExecutor: true },
    { id: USR.otherSubAdmin, email: 'other.sub.admin@test.local', role: UserRole.ADMIN, companyId: CO.otherSub, isExecutor: false },
    { id: USR.otherSubTech, email: 'other.sub.tech@test.local', role: UserRole.TECHNICIAN, companyId: CO.otherSub, isExecutor: true },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        password: passwordHash,
        role: u.role,
        companyId: u.companyId,
        isExecutor: u.isExecutor,
        isActive: true,
      },
      create: {
        id: u.id,
        email: u.email,
        password: passwordHash,
        role: u.role,
        firstName: u.email.split('@')[0],
        isExecutor: u.isExecutor,
        isActive: true,
        companyId: u.companyId,
      },
    })
  }

  // ---- Locations (owned by the CLIENT company) ------------------------------
  const locations: Array<{ id: string; name: string; platformCode: string; city: string }> = [
    { id: LOC.zosimovBound, name: 'Фудзияма — Тверская', platformCode: 'FJ-001', city: 'Москва' },
    { id: LOC.otherBound, name: 'Фудзияма — Арбат', platformCode: 'FJ-002', city: 'Москва' },
    { id: LOC.unrelated, name: 'Фудзияма — Невский', platformCode: 'FJ-003', city: 'Санкт-Петербург' },
  ]

  for (const l of locations) {
    await prisma.location.upsert({
      where: { clientCompanyId_platformCode: { clientCompanyId: CO.client, platformCode: l.platformCode } },
      update: { name: l.name, city: l.city, isActive: true },
      create: {
        id: l.id,
        clientCompanyId: CO.client,
        name: l.name,
        platformCode: l.platformCode,
        city: l.city,
        isActive: true,
      },
    })
  }

  // ---- Problem category (owned by the CLIENT company) -----------------------
  await prisma.problemCategory.upsert({
    where: { companyId_name: { companyId: CO.client, name: 'Общее обслуживание' } },
    update: { isActive: true },
    create: { id: CAT.general, companyId: CO.client, name: 'Общее обслуживание', isActive: true },
  })

  // ---- Provider-user → client-location bindings -----------------------------
  // companyId semantics depend on the tech's contract type:
  //   • Sub-contractor techs (zosimov/otherSub): companyId = their PROVIDER company (scoping via TechnicianClientBinding)
  //   • PRIMARY-contract techs (secondaryTech): companyId = CLIENT company
  //     because getBoundContexts queries `companyId IN (clientIds)` — it expects the client side.
  const bindings: Array<{ id: string; userId: string; locationId: string; companyId: string }> = [
    // Zosimov tech1 is bound to the Zosimov location (provider-scoped via TechnicianClientBinding flow).
    { id: '60000000-0000-4000-8000-000000000001', userId: USR.zosimovTech1, locationId: LOC.zosimovBound, companyId: CO.zosimov },
    // Other Subcontractor tech is bound to the Other location (provider-scoped).
    { id: '60000000-0000-4000-8000-000000000002', userId: USR.otherSubTech, locationId: LOC.otherBound, companyId: CO.otherSub },
    // tech@test.local (CO.secondary PRIMARY tech): bound to Фудзияма–Арбат via CLIENT company ID
    // so that getBoundContexts returns QA Client Co / Фудзияма–Арбат.
    { id: '60000000-0000-4000-8000-000000000003', userId: USR.secondaryTech, locationId: LOC.otherBound, companyId: CO.client },
    // CLIENT-company TERRITORIAL_MANAGER: scoped to Фудзияма — Арбат (client-owned location).
    { id: '60000000-0000-4000-8000-000000000004', userId: USR.clientTerritorialManager, locationId: LOC.otherBound, companyId: CO.client },
  ]

  for (const b of bindings) {
    await prisma.userLocationBinding.upsert({
      where: { userId_locationId: { userId: b.userId, locationId: b.locationId } },
      update: { companyId: b.companyId },
      create: { id: b.id, userId: b.userId, locationId: b.locationId, companyId: b.companyId },
    })
  }

  // ---- Technician → client bindings (provider-scoped) -----------------------
  // providerCompanyId = the subcontractor company that employs the technician;
  // clientCompanyId    = QA Client Co; locationId scopes the binding to one client location.
  // Zosimov tech1 + tech2 are both scoped to FJ-001 (multiple techs of one subcontractor
  // at one client location); Other Subcontractor tech is scoped to FJ-002 — keeping the
  // two subcontractors on disjoint locations so cross-subcontractor isolation is testable.
  const technicianClientBindings: Array<{
    id: string
    providerCompanyId: string
    technicianUserId: string
    clientCompanyId: string
    locationId: string
  }> = [
    { id: TCB.zosimovTech1, providerCompanyId: CO.zosimov, technicianUserId: USR.zosimovTech1, clientCompanyId: CO.client, locationId: LOC.zosimovBound },
    { id: TCB.zosimovTech2, providerCompanyId: CO.zosimov, technicianUserId: USR.zosimovTech2, clientCompanyId: CO.client, locationId: LOC.zosimovBound },
    { id: TCB.otherSubTech, providerCompanyId: CO.otherSub, technicianUserId: USR.otherSubTech, clientCompanyId: CO.client, locationId: LOC.otherBound },
    { id: TCB.secondaryTech, providerCompanyId: CO.secondary, technicianUserId: USR.secondaryTech, clientCompanyId: CO.client, locationId: LOC.otherBound },
  ]

  for (const b of technicianClientBindings) {
    await prisma.technicianClientBinding.upsert({
      where: {
        technicianUserId_clientCompanyId_locationId: {
          technicianUserId: b.technicianUserId,
          clientCompanyId: b.clientCompanyId,
          locationId: b.locationId,
        },
      },
      update: { providerCompanyId: b.providerCompanyId },
      create: {
        id: b.id,
        providerCompanyId: b.providerCompanyId,
        technicianUserId: b.technicianUserId,
        clientCompanyId: b.clientCompanyId,
        locationId: b.locationId,
      },
    })
  }

  // ---- Tickets (companyId = CLIENT, invariant) ------------------------------
  const tickets: Array<{
    id: string
    locationId: string
    problemText: string
    status: TicketStatus
    assignedTechnicianId: string | null
  }> = [
    {
      id: TKT.generalScope,
      locationId: LOC.unrelated,
      problemText: 'General provider scope — unassigned ticket at unrelated location',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    },
    {
      id: TKT.zosimovAssigned,
      locationId: LOC.zosimovBound,
      problemText: 'Assigned to Zosimov technician #1',
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: USR.zosimovTech1,
    },
    {
      id: TKT.otherAssigned,
      locationId: LOC.otherBound,
      problemText: 'Assigned to Other Subcontractor technician',
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: USR.otherSubTech,
    },
    {
      id: TKT.zosimovLocationUnassigned,
      locationId: LOC.zosimovBound,
      problemText: 'Unassigned ticket at Zosimov-bound location',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    },
    {
      id: TKT.unrelatedUnassigned,
      locationId: LOC.unrelated,
      problemText: 'Unassigned ticket at unrelated location',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    },
  ]

  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {
        locationId: t.locationId,
        problemText: t.problemText,
        status: t.status,
        assignedTechnicianId: t.assignedTechnicianId,
      },
      create: {
        id: t.id,
        companyId: CO.client,
        locationId: t.locationId,
        problemCategoryId: CAT.general,
        problemText: t.problemText,
        status: t.status,
        assignedTechnicianId: t.assignedTechnicianId,
      },
    })
  }

  // ---- Service contracts (current Client ↔ Provider model) ------------------
  // QA General Provider → QA Client as PRIMARY
  await prisma.serviceContract.upsert({
    where: { clientCompanyId_providerCompanyId: { clientCompanyId: CO.client, providerCompanyId: CO.general } },
    update: { role: ServiceContractRole.PRIMARY, status: ServiceContractStatus.ACTIVE },
    create: {
      clientCompanyId: CO.client,
      providerCompanyId: CO.general,
      role: ServiceContractRole.PRIMARY,
      status: ServiceContractStatus.ACTIVE,
    },
  })

  // QA Secondary Provider → QA Client as PRIMARY
  // PRIMARY (not SECONDARY) so that getBoundContexts → listPrimaryLinkedClientIds returns
  // CO.client for tech@test.local, enabling the mobile bound-context flow.
  await prisma.serviceContract.upsert({
    where: { clientCompanyId_providerCompanyId: { clientCompanyId: CO.client, providerCompanyId: CO.secondary } },
    update: { role: ServiceContractRole.PRIMARY, status: ServiceContractStatus.ACTIVE },
    create: {
      clientCompanyId: CO.client,
      providerCompanyId: CO.secondary,
      role: ServiceContractRole.PRIMARY,
      status: ServiceContractStatus.ACTIVE,
    },
  })

  // NOTE: SubcontractorContract (General → Zosimov / General → Other Subcontractor)
  // is intentionally NOT created — the model does not exist yet. Once it lands,
  // add it here; no other fixture changes are required.

  console.log('Stage QA seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
