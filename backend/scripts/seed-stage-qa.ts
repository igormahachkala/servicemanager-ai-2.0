import {
  CompanyType,
  Prisma,
  PrismaClient,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  TicketAttachmentPurpose,
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketUrgency,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client'
import * as bcrypt from 'bcrypt'

import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../src/common/permissions-matrix'

const PASSWORD_ENV = 'STAGE_CANONICAL_PASSWORD'

const IDS = {
  company: {
    client: '10000000-0000-4000-8000-000000001001',
    primaryProvider: '10000000-0000-4000-8000-000000001002',
    secondaryProvider: '10000000-0000-4000-8000-000000001003',
  },
  location: {
    primary: '30000000-0000-4000-8000-000000001001',
    secondary: '30000000-0000-4000-8000-000000001002',
    outside: '30000000-0000-4000-8000-000000001003',
  },
  specialization: {
    hvac: '40000000-0000-4000-8000-000000001001',
    electrical: '40000000-0000-4000-8000-000000001002',
    plumbing: '40000000-0000-4000-8000-000000001003',
  },
  category: {
    hvac: '41000000-0000-4000-8000-000000001001',
    electrical: '41000000-0000-4000-8000-000000001002',
    plumbing: '41000000-0000-4000-8000-000000001003',
  },
  user: {
    clientAdmin: '20000000-0000-4000-8000-000000001001',
    networkDirector: '20000000-0000-4000-8000-000000001002',
    territorialManager: '20000000-0000-4000-8000-000000001003',
    primaryAdmin: '20000000-0000-4000-8000-000000001101',
    primaryDispatcher: '20000000-0000-4000-8000-000000001102',
    primaryMaster: '20000000-0000-4000-8000-000000001103',
    primaryTechnician: '20000000-0000-4000-8000-000000001104',
    secondaryAdmin: '20000000-0000-4000-8000-000000001201',
    secondaryDispatcher: '20000000-0000-4000-8000-000000001202',
    secondaryMaster: '20000000-0000-4000-8000-000000001203',
    secondaryTechnician: '20000000-0000-4000-8000-000000001204',
    mobileTechnician: '20000000-0000-4000-8000-000000001205',
  },
  ticket: {
    A: '50000000-0000-4000-8000-000000001001',
    B: '50000000-0000-4000-8000-000000001002',
    C: '50000000-0000-4000-8000-000000001003',
    D: '50000000-0000-4000-8000-000000001004',
    E: '50000000-0000-4000-8000-000000001005',
    F: '50000000-0000-4000-8000-000000001006',
    G: '50000000-0000-4000-8000-000000001007',
    H: '50000000-0000-4000-8000-000000001008',
    I: '50000000-0000-4000-8000-000000001009',
    DONE: '50000000-0000-4000-8000-000000001010',
  },
}

type CompanyKey = keyof typeof IDS.company
type LocationKey = keyof typeof IDS.location
type SpecializationKey = keyof typeof IDS.specialization
type CategoryKey = keyof typeof IDS.category
type UserKey = keyof typeof IDS.user
export type StageFixtureKey = keyof typeof IDS.ticket

type CanonicalCompany = {
  key: CompanyKey
  id: string
  name: string
  type: CompanyType
}

type CanonicalUser = {
  key: UserKey
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  companyKey: CompanyKey
  isExecutor: boolean
}

type CanonicalLocation = {
  key: LocationKey
  id: string
  platformCode: string
  name: string
  city: string
  address: string
}

type CanonicalSpecialization = {
  key: SpecializationKey
  id: string
  name: string
}

type CanonicalCategory = {
  key: CategoryKey
  id: string
  name: string
  specializationKey: SpecializationKey
}

type CanonicalTicket = {
  key: StageFixtureKey
  id: string
  ticketNumber: number
  title: string
  purpose: string
  status: TicketStatus
  locationKey: LocationKey
  categoryKey: CategoryKey
  createdByUserKey: UserKey
  assignedUserKey?: UserKey
  requesterName: string
  priority: TicketPriority
  urgency: TicketUrgency
  slaMinutes: number
  createdAt: Date
}

export const CANONICAL_STAGE_SEED = {
  passwordEnv: PASSWORD_ENV,
  defaultPasswordLabel: 'No default password is committed; provide STAGE_CANONICAL_PASSWORD at runtime',
  companies: [
    {
      key: 'client',
      id: IDS.company.client,
      name: 'SMA Stage Canonical Client',
      type: CompanyType.CLIENT,
    },
    {
      key: 'primaryProvider',
      id: IDS.company.primaryProvider,
      name: 'SMA Stage Canonical Primary Provider',
      type: CompanyType.PROVIDER,
    },
    {
      key: 'secondaryProvider',
      id: IDS.company.secondaryProvider,
      name: 'SMA Stage Canonical Secondary Provider',
      type: CompanyType.PROVIDER,
    },
  ] satisfies CanonicalCompany[],
  users: [
    {
      key: 'clientAdmin',
      id: IDS.user.clientAdmin,
      email: 'stage.client.admin@stage.local',
      firstName: 'Stage Client',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      companyKey: 'client',
      isExecutor: false,
    },
    {
      key: 'networkDirector',
      id: IDS.user.networkDirector,
      email: 'stage.network.director@stage.local',
      firstName: 'Stage Network',
      lastName: 'Director',
      role: UserRole.NETWORK_DIRECTOR,
      companyKey: 'client',
      isExecutor: false,
    },
    {
      key: 'territorialManager',
      id: IDS.user.territorialManager,
      email: 'stage.territorial.manager@stage.local',
      firstName: 'Stage Territorial',
      lastName: 'Manager',
      role: UserRole.TERRITORIAL_MANAGER,
      companyKey: 'client',
      isExecutor: false,
    },
    {
      key: 'primaryAdmin',
      id: IDS.user.primaryAdmin,
      email: 'stage.primary.admin@stage.local',
      firstName: 'Stage Primary',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      companyKey: 'primaryProvider',
      isExecutor: false,
    },
    {
      key: 'primaryDispatcher',
      id: IDS.user.primaryDispatcher,
      email: 'stage.primary.dispatcher@stage.local',
      firstName: 'Stage Primary',
      lastName: 'Dispatcher',
      role: UserRole.DISPATCHER,
      companyKey: 'primaryProvider',
      isExecutor: false,
    },
    {
      key: 'primaryMaster',
      id: IDS.user.primaryMaster,
      email: 'stage.primary.master@stage.local',
      firstName: 'Stage Primary',
      lastName: 'Master',
      role: UserRole.MASTER,
      companyKey: 'primaryProvider',
      isExecutor: false,
    },
    {
      key: 'primaryTechnician',
      id: IDS.user.primaryTechnician,
      email: 'stage.primary.tech@stage.local',
      firstName: 'Stage Primary',
      lastName: 'Technician',
      role: UserRole.TECHNICIAN,
      companyKey: 'primaryProvider',
      isExecutor: true,
    },
    {
      key: 'secondaryAdmin',
      id: IDS.user.secondaryAdmin,
      email: 'stage.secondary.admin@stage.local',
      firstName: 'Stage Secondary',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      companyKey: 'secondaryProvider',
      isExecutor: false,
    },
    {
      key: 'secondaryDispatcher',
      id: IDS.user.secondaryDispatcher,
      email: 'stage.secondary.dispatcher@stage.local',
      firstName: 'Stage Secondary',
      lastName: 'Dispatcher',
      role: UserRole.DISPATCHER,
      companyKey: 'secondaryProvider',
      isExecutor: false,
    },
    {
      key: 'secondaryMaster',
      id: IDS.user.secondaryMaster,
      email: 'stage.secondary.master@stage.local',
      firstName: 'Stage Secondary',
      lastName: 'Master',
      role: UserRole.MASTER,
      companyKey: 'secondaryProvider',
      isExecutor: false,
    },
    {
      key: 'secondaryTechnician',
      id: IDS.user.secondaryTechnician,
      email: 'stage.secondary.tech@stage.local',
      firstName: 'Stage Secondary',
      lastName: 'Technician',
      role: UserRole.TECHNICIAN,
      companyKey: 'secondaryProvider',
      isExecutor: true,
    },
    {
      key: 'mobileTechnician',
      id: IDS.user.mobileTechnician,
      email: 'stage.mobile.tech@stage.local',
      firstName: 'Stage Mobile',
      lastName: 'Technician',
      role: UserRole.TECHNICIAN,
      companyKey: 'secondaryProvider',
      isExecutor: true,
    },
  ] satisfies CanonicalUser[],
  locations: [
    {
      key: 'primary',
      id: IDS.location.primary,
      platformCode: 'SMA-QA-PRIMARY',
      name: 'SMA QA Primary Location',
      city: 'Москва',
      address: 'Москва, Stage QA Primary, 1',
    },
    {
      key: 'secondary',
      id: IDS.location.secondary,
      platformCode: 'SMA-QA-SECONDARY',
      name: 'SMA QA Secondary Location',
      city: 'Москва',
      address: 'Москва, Stage QA Secondary, 2',
    },
    {
      key: 'outside',
      id: IDS.location.outside,
      platformCode: 'SMA-QA-OUTSIDE',
      name: 'SMA QA Outside Location',
      city: 'Москва',
      address: 'Москва, Stage QA Outside, 3',
    },
  ] satisfies CanonicalLocation[],
  specializations: [
    { key: 'hvac', id: IDS.specialization.hvac, name: 'Stage QA HVAC' },
    { key: 'electrical', id: IDS.specialization.electrical, name: 'Stage QA Electrical' },
    { key: 'plumbing', id: IDS.specialization.plumbing, name: 'Stage QA Plumbing' },
  ] satisfies CanonicalSpecialization[],
  categories: [
    {
      key: 'hvac',
      id: IDS.category.hvac,
      name: 'Stage QA HVAC category',
      specializationKey: 'hvac',
    },
    {
      key: 'electrical',
      id: IDS.category.electrical,
      name: 'Stage QA Electrical category',
      specializationKey: 'electrical',
    },
    {
      key: 'plumbing',
      id: IDS.category.plumbing,
      name: 'Stage QA Plumbing category',
      specializationKey: 'plumbing',
    },
  ] satisfies CanonicalCategory[],
  contracts: [
    {
      providerCompanyKey: 'primaryProvider' as const,
      role: ServiceContractRole.PRIMARY,
      locationKeys: ['primary', 'secondary'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical'] as SpecializationKey[],
    },
    {
      providerCompanyKey: 'secondaryProvider' as const,
      role: ServiceContractRole.SECONDARY,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
  ],
  userScopes: [
    {
      userKey: 'clientAdmin' as const,
      locationKeys: ['primary', 'secondary', 'outside'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical', 'plumbing'] as SpecializationKey[],
    },
    {
      userKey: 'networkDirector' as const,
      locationKeys: ['primary', 'secondary'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical'] as SpecializationKey[],
    },
    {
      userKey: 'territorialManager' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
    {
      userKey: 'primaryAdmin' as const,
      locationKeys: ['primary', 'secondary'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical'] as SpecializationKey[],
    },
    {
      userKey: 'primaryDispatcher' as const,
      locationKeys: ['primary', 'secondary'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical'] as SpecializationKey[],
    },
    {
      userKey: 'primaryMaster' as const,
      locationKeys: ['primary', 'secondary'] as LocationKey[],
      specializationKeys: ['hvac', 'electrical'] as SpecializationKey[],
    },
    {
      userKey: 'primaryTechnician' as const,
      locationKeys: ['primary'] as LocationKey[],
      specializationKeys: ['hvac'] as SpecializationKey[],
    },
    {
      userKey: 'secondaryAdmin' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
    {
      userKey: 'secondaryDispatcher' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
    {
      userKey: 'secondaryMaster' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
    {
      userKey: 'secondaryTechnician' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
    {
      userKey: 'mobileTechnician' as const,
      locationKeys: ['secondary'] as LocationKey[],
      specializationKeys: ['electrical'] as SpecializationKey[],
    },
  ],
  tickets: [
    {
      key: 'A',
      id: IDS.ticket.A,
      ticketNumber: 9101,
      title: 'A — valid PRIMARY work',
      purpose: 'PRIMARY positive visibility and assignment fixture',
      status: TicketStatus.NEW,
      locationKey: 'primary',
      categoryKey: 'hvac',
      createdByUserKey: 'clientAdmin',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T07:00:00.000Z'),
    },
    {
      key: 'B',
      id: IDS.ticket.B,
      ticketNumber: 9102,
      title: 'B — valid SECONDARY assigned work',
      purpose: 'SECONDARY assigned technician fixture',
      status: TicketStatus.ASSIGNED,
      locationKey: 'secondary',
      categoryKey: 'electrical',
      createdByUserKey: 'clientAdmin',
      assignedUserKey: 'secondaryTechnician',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.URGENT,
      urgency: TicketUrgency.URGENT,
      slaMinutes: 120,
      createdAt: new Date('2026-08-20T07:10:00.000Z'),
    },
    {
      key: 'C',
      id: IDS.ticket.C,
      ticketNumber: 9103,
      title: 'C — valid SECONDARY unassigned work',
      purpose: 'SECONDARY visible unassigned fixture',
      status: TicketStatus.NEW,
      locationKey: 'secondary',
      categoryKey: 'electrical',
      createdByUserKey: 'clientAdmin',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T07:20:00.000Z'),
    },
    {
      key: 'D',
      id: IDS.ticket.D,
      ticketNumber: 9104,
      title: 'D — wrong location negative',
      purpose: 'Location mismatch only: electrical specialization but outside contract/user location',
      status: TicketStatus.NEW,
      locationKey: 'outside',
      categoryKey: 'electrical',
      createdByUserKey: 'clientAdmin',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T07:30:00.000Z'),
    },
    {
      key: 'E',
      id: IDS.ticket.E,
      ticketNumber: 9105,
      title: 'E — wrong specialization negative',
      purpose: 'Specialization mismatch only: secondary location but plumbing specialization',
      status: TicketStatus.DONE,
      locationKey: 'secondary',
      categoryKey: 'plumbing',
      createdByUserKey: 'clientAdmin',
      assignedUserKey: 'primaryTechnician',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T07:40:00.000Z'),
    },
    {
      key: 'F',
      id: IDS.ticket.F,
      ticketNumber: 9106,
      title: 'F — awaiting client acceptance',
      purpose: 'CLIENT acceptance positive fixture',
      status: TicketStatus.AWAITING_ACCEPTANCE,
      locationKey: 'primary',
      categoryKey: 'hvac',
      createdByUserKey: 'clientAdmin',
      assignedUserKey: 'primaryTechnician',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T07:50:00.000Z'),
    },
    {
      key: 'G',
      id: IDS.ticket.G,
      ticketNumber: 9107,
      title: 'G — SECONDARY in progress',
      purpose: 'SECONDARY technician completion fixture',
      status: TicketStatus.IN_PROGRESS,
      locationKey: 'secondary',
      categoryKey: 'electrical',
      createdByUserKey: 'clientAdmin',
      assignedUserKey: 'secondaryTechnician',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.URGENT,
      urgency: TicketUrgency.URGENT,
      slaMinutes: 120,
      createdAt: new Date('2026-08-20T08:00:00.000Z'),
    },
    {
      key: 'H',
      id: IDS.ticket.H,
      ticketNumber: 9108,
      title: 'H — client-created SECONDARY claim denial',
      purpose: 'SECONDARY technician direct claim denial fixture',
      status: TicketStatus.NEW,
      locationKey: 'secondary',
      categoryKey: 'electrical',
      createdByUserKey: 'clientAdmin',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T08:10:00.000Z'),
    },
    {
      key: 'I',
      id: IDS.ticket.I,
      ticketNumber: 9109,
      title: 'I — SECONDARY technician self-created claim exception',
      purpose: 'Self-created SECONDARY technician claim exception fixture',
      status: TicketStatus.NEW,
      locationKey: 'secondary',
      categoryKey: 'electrical',
      createdByUserKey: 'secondaryTechnician',
      requesterName: 'Stage QA Secondary Technician',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T08:20:00.000Z'),
    },
    {
      key: 'DONE',
      id: IDS.ticket.DONE,
      ticketNumber: 9110,
      title: 'DONE — visible completed PRIMARY ticket',
      purpose: 'Completed ticket visibility fixture for desktop and mobile',
      status: TicketStatus.DONE,
      locationKey: 'primary',
      categoryKey: 'hvac',
      createdByUserKey: 'clientAdmin',
      assignedUserKey: 'primaryTechnician',
      requesterName: 'Stage QA Client Admin',
      priority: TicketPriority.NORMAL,
      urgency: TicketUrgency.NOT_URGENT,
      slaMinutes: 240,
      createdAt: new Date('2026-08-20T08:30:00.000Z'),
    },
  ] satisfies CanonicalTicket[],
} as const

type ResolvedSeedIds = {
  companies: Record<CompanyKey, string>
  locations: Record<LocationKey, string>
  specializations: Record<SpecializationKey, string>
  categories: Record<CategoryKey, string>
  users: Record<UserKey, string>
  contracts: Partial<Record<'primaryProvider' | 'secondaryProvider', string>>
}

type SeedTicketResult = {
  key: StageFixtureKey
  id: string
  ticketNumber: number
  status: TicketStatus
  purpose: string
}

export type CanonicalStageSeedResult = {
  companies: number
  users: number
  locations: number
  specializations: number
  categories: number
  contracts: number
  tickets: SeedTicketResult[]
  permissionBlocks: number
  rolePermissions: number
  providerDelegation: 'not_supported_by_current_schema'
}

function lowerEmail(email: string) {
  return email.trim().toLowerCase()
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function unique<T>(items: readonly T[]) {
  return Array.from(new Set(items))
}

function hasTicketStatus(statuses: readonly TicketStatus[], status: TicketStatus) {
  return statuses.includes(status)
}

function assertUnique(label: string, items: readonly string[]) {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item)) {
      throw new Error(`[seed-stage-canonical] duplicate ${label}: ${item}`)
    }
    seen.add(item)
  }
}

function resolveSeedPassword(passwordOverride?: string) {
  const password = passwordOverride ?? process.env[PASSWORD_ENV]
  if (!password) {
    throw new Error(`[seed-stage-canonical] ${PASSWORD_ENV} is required; no password is stored in source`)
  }
  return password
}

export function validateCanonicalStageSeedPlan() {
  assertUnique('company id', CANONICAL_STAGE_SEED.companies.map((row) => row.id))
  assertUnique('user id', CANONICAL_STAGE_SEED.users.map((row) => row.id))
  assertUnique('user email', CANONICAL_STAGE_SEED.users.map((row) => lowerEmail(row.email)))
  assertUnique('location id', CANONICAL_STAGE_SEED.locations.map((row) => row.id))
  assertUnique('location platformCode', CANONICAL_STAGE_SEED.locations.map((row) => row.platformCode))
  assertUnique('specialization id', CANONICAL_STAGE_SEED.specializations.map((row) => row.id))
  assertUnique('category id', CANONICAL_STAGE_SEED.categories.map((row) => row.id))
  assertUnique('ticket id', CANONICAL_STAGE_SEED.tickets.map((row) => row.id))
  assertUnique('ticket number', CANONICAL_STAGE_SEED.tickets.map((row) => String(row.ticketNumber)))

  const statuses = new Set(CANONICAL_STAGE_SEED.tickets.map((row) => row.status))
  for (const status of [
    TicketStatus.NEW,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.AWAITING_ACCEPTANCE,
    TicketStatus.DONE,
  ]) {
    if (!statuses.has(status)) {
      throw new Error(`[seed-stage-canonical] missing ticket status fixture: ${status}`)
    }
  }

  for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] satisfies StageFixtureKey[]) {
    if (!CANONICAL_STAGE_SEED.tickets.some((row) => row.key === key)) {
      throw new Error(`[seed-stage-canonical] missing acceptance fixture ${key}`)
    }
  }
}

async function seedPermissions(prisma: PrismaClient) {
  for (const block of PERMISSION_BLOCKS) {
    await prisma.permissionBlock.upsert({
      where: { code: block.code },
      update: { name: block.name, description: block.description ?? null },
      create: {
        code: block.code,
        name: block.name,
        description: block.description ?? null,
      },
    })
  }

  const blocks = await prisma.permissionBlock.findMany({
    select: { id: true, code: true },
  })
  const codeToId = new Map(blocks.map((block) => [block.code, block.id]))

  const rows: Array<{
    role: UserRole
    companyType: CompanyType | null
    permissionBlockId: string
  }> = []
  for (const grant of ROLE_GRANTS) {
    for (const code of grant.codes) {
      const permissionBlockId = codeToId.get(code)
      if (!permissionBlockId) {
        throw new Error(`[seed-stage-canonical] missing PermissionBlock for ${code}`)
      }
      rows.push({
        role: grant.role,
        companyType: grant.companyType,
        permissionBlockId,
      })
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({}),
    prisma.rolePermission.createMany({ data: rows, skipDuplicates: true }),
  ])
}

async function ensureCompany(prisma: PrismaClient, row: CanonicalCompany) {
  const existingById = await prisma.company.findUnique({
    where: { id: row.id },
    select: { id: true },
  })
  const existing =
    existingById ??
    (await prisma.company.findFirst({
      where: { name: row.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.company.update({
      where: { id: existing.id },
      data: {
        name: row.name,
        type: row.type,
        autoAssignEnabled: false,
        allowTechnicianClaim: true,
        publicRequestEnabled: false,
        slaStrictMode: false,
      },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.company.create({
    data: {
      id: row.id,
      name: row.name,
      type: row.type,
      autoAssignEnabled: false,
      allowTechnicianClaim: true,
      publicRequestEnabled: false,
      slaStrictMode: false,
    },
    select: { id: true },
  })
  return created.id
}

async function ensureUser(
  prisma: PrismaClient,
  row: CanonicalUser,
  companyId: string,
  passwordHash: string,
) {
  const email = lowerEmail(row.email)
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  const existing =
    existingByEmail ??
    (await prisma.user.findUnique({
      where: { id: row.id },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        password: passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        companyId,
        isExecutor: row.isExecutor,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.user.create({
    data: {
      id: row.id,
      email,
      password: passwordHash,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      companyId,
      isExecutor: row.isExecutor,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  })
  return created.id
}

async function ensureLocation(
  prisma: PrismaClient,
  row: CanonicalLocation,
  clientCompanyId: string,
) {
  const location = await prisma.location.upsert({
    where: {
      clientCompanyId_platformCode: {
        clientCompanyId,
        platformCode: row.platformCode,
      },
    },
    update: {
      name: row.name,
      city: row.city,
      address: row.address,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: row.id,
      clientCompanyId,
      platformCode: row.platformCode,
      name: row.name,
      city: row.city,
      address: row.address,
      isActive: true,
    },
    select: { id: true },
  })
  return location.id
}

async function ensureSpecialization(
  prisma: PrismaClient,
  row: CanonicalSpecialization,
  companyId: string,
) {
  const existing =
    (await prisma.specialization.findFirst({
      where: { id: row.id },
      select: { id: true },
    })) ??
    (await prisma.specialization.findFirst({
      where: { companyId, name: row.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.specialization.update({
      where: { id: existing.id },
      data: { companyId, name: row.name, isActive: true },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.specialization.create({
    data: { id: row.id, companyId, name: row.name, isActive: true },
    select: { id: true },
  })
  return created.id
}

async function ensureCategory(
  prisma: PrismaClient,
  row: CanonicalCategory,
  companyId: string,
  specializationId: string,
) {
  const category = await prisma.problemCategory.upsert({
    where: { companyId_name: { companyId, name: row.name } },
    update: { isActive: true, instructions: `Canonical Stage QA fixture: ${row.key}` },
    create: {
      id: row.id,
      companyId,
      name: row.name,
      instructions: `Canonical Stage QA fixture: ${row.key}`,
      isActive: true,
    },
    select: { id: true },
  })

  await prisma.problemCategorySpecialization.deleteMany({
    where: { problemCategoryId: category.id },
  })
  await prisma.problemCategorySpecialization.create({
    data: { problemCategoryId: category.id, specializationId },
  })

  return category.id
}

async function ensureServiceContract(
  prisma: PrismaClient,
  params: {
    clientCompanyId: string
    providerCompanyId: string
    role: ServiceContractRole
    locationIds: string[]
    specializationIds: string[]
  },
) {
  const contract = await prisma.serviceContract.upsert({
    where: {
      clientCompanyId_providerCompanyId: {
        clientCompanyId: params.clientCompanyId,
        providerCompanyId: params.providerCompanyId,
      },
    },
    update: {
      status: ServiceContractStatus.ACTIVE,
      role: params.role,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      startsAt: null,
      endsAt: null,
      notes: `Canonical Stage ${params.role} contract context fixture`,
    },
    create: {
      clientCompanyId: params.clientCompanyId,
      providerCompanyId: params.providerCompanyId,
      status: ServiceContractStatus.ACTIVE,
      role: params.role,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      startsAt: null,
      endsAt: null,
      notes: `Canonical Stage ${params.role} contract context fixture`,
    },
    select: { id: true },
  })

  await prisma.serviceContractLocation.deleteMany({
    where: {
      serviceContractId: contract.id,
      locationId: { notIn: params.locationIds },
    },
  })
  await prisma.serviceContractLocation.createMany({
    data: params.locationIds.map((locationId) => ({
      serviceContractId: contract.id,
      clientCompanyId: params.clientCompanyId,
      locationId,
    })),
    skipDuplicates: true,
  })

  await prisma.serviceContractSpecialization.deleteMany({
    where: {
      serviceContractId: contract.id,
      specializationId: { notIn: params.specializationIds },
    },
  })
  await prisma.serviceContractSpecialization.createMany({
    data: params.specializationIds.map((specializationId) => ({
      serviceContractId: contract.id,
      specializationId,
    })),
    skipDuplicates: true,
  })

  return contract.id
}

async function resetCanonicalUserScopes(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const userIds = Object.values(ids.users)
  await prisma.$transaction([
    prisma.userLocationBinding.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.technicianSpecialization.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userAccessScope.deleteMany({ where: { userId: { in: userIds } } }),
  ])

  const scopeRows = CANONICAL_STAGE_SEED.userScopes.map((scope) => {
    const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === scope.userKey)!
    return {
      userId: ids.users[scope.userKey],
      companyId: ids.companies[user.companyKey],
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    }
  })

  await prisma.userAccessScope.createMany({
    data: scopeRows,
    skipDuplicates: true,
  })

  const locationRows = CANONICAL_STAGE_SEED.userScopes.flatMap((scope) => {
    const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === scope.userKey)!
    return scope.locationKeys.map((locationKey) => ({
      userId: ids.users[scope.userKey],
      companyId: ids.companies[user.companyKey],
      locationId: ids.locations[locationKey],
    }))
  })

  await prisma.userLocationBinding.createMany({
    data: locationRows,
    skipDuplicates: true,
  })

  const specializationRows = CANONICAL_STAGE_SEED.userScopes.flatMap((scope) =>
    scope.specializationKeys.map((specializationKey) => ({
      userId: ids.users[scope.userKey],
      specializationId: ids.specializations[specializationKey],
    })),
  )

  await prisma.technicianSpecialization.createMany({
    data: specializationRows,
    skipDuplicates: true,
  })
}

async function ensureTechnicianClientBindings(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const rows = [
    {
      providerCompanyKey: 'primaryProvider' as CompanyKey,
      technicianUserKey: 'primaryTechnician' as UserKey,
      locationKey: 'primary' as LocationKey,
    },
    {
      providerCompanyKey: 'secondaryProvider' as CompanyKey,
      technicianUserKey: 'secondaryTechnician' as UserKey,
      locationKey: 'secondary' as LocationKey,
    },
    {
      providerCompanyKey: 'secondaryProvider' as CompanyKey,
      technicianUserKey: 'mobileTechnician' as UserKey,
      locationKey: 'secondary' as LocationKey,
    },
  ]

  await prisma.technicianClientBinding.deleteMany({
    where: {
      technicianUserId: { in: rows.map((row) => ids.users[row.technicianUserKey]) },
      clientCompanyId: ids.companies.client,
    },
  })

  await prisma.technicianClientBinding.createMany({
    data: rows.map((row, index) => ({
      id: `70000000-0000-4000-8000-00000000100${index + 1}`,
      providerCompanyId: ids.companies[row.providerCompanyKey],
      technicianUserId: ids.users[row.technicianUserKey],
      clientCompanyId: ids.companies.client,
      locationId: ids.locations[row.locationKey],
    })),
    skipDuplicates: true,
  })
}

async function assertTicketNumberAvailable(
  prisma: PrismaClient,
  ticketId: string,
  ticketNumber: number,
) {
  const existing = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  })
  if (existing && existing.id !== ticketId) {
    throw new Error(
      `[seed-stage-canonical] ticket number ${ticketNumber} is already used by non-canonical ticket ${existing.id}`,
    )
  }
}

function ticketLifecycle(ticket: CanonicalTicket, ids: ResolvedSeedIds) {
  const actorId = ids.users[ticket.createdByUserKey]
  const assigneeId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
  const rows: Array<{
    fromStatus: TicketStatus | null
    toStatus: TicketStatus
    changedByUserId: string | null
    comment: string
    at: Date
  }> = [
    {
      fromStatus: null,
      toStatus: TicketStatus.NEW,
      changedByUserId: actorId,
      comment: `Stage fixture ${ticket.key} created`,
      at: ticket.createdAt,
    },
  ]

  if (
    hasTicketStatus([
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.ASSIGNED,
      changedByUserId: ids.users.primaryAdmin,
      comment: assigneeId ? 'Stage fixture assigned' : 'Stage fixture assigned without executor',
      at: addMinutes(ticket.createdAt, 10),
    })
  }

  if (
    hasTicketStatus([
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      fromStatus: TicketStatus.ASSIGNED,
      toStatus: TicketStatus.IN_PROGRESS,
      changedByUserId: assigneeId,
      comment: 'Stage fixture work started',
      at: addMinutes(ticket.createdAt, 20),
    })
  }

  if (hasTicketStatus([TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE], ticket.status)) {
    rows.push({
      fromStatus: TicketStatus.IN_PROGRESS,
      toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      changedByUserId: assigneeId,
      comment: 'Stage fixture work completed and sent to acceptance',
      at: addMinutes(ticket.createdAt, 40),
    })
  }

  if (ticket.status === TicketStatus.DONE) {
    rows.push({
      fromStatus: TicketStatus.AWAITING_ACCEPTANCE,
      toStatus: TicketStatus.DONE,
      changedByUserId: ids.users.clientAdmin,
      comment: 'Stage fixture accepted by client',
      at: addMinutes(ticket.createdAt, 60),
    })
  }

  return rows
}

function ticketEvents(ticket: CanonicalTicket, ids: ResolvedSeedIds) {
  const actorId = ids.users[ticket.createdByUserKey]
  const assigneeId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
  const rows: Array<{
    type: string
    actorUserId: string | null
    payload: Prisma.InputJsonValue
    createdAt: Date
  }> = [
    {
      type: 'ticket.created',
      actorUserId: actorId,
      payload: {
        fixtureKey: ticket.key,
        purpose: ticket.purpose,
        locationId: ids.locations[ticket.locationKey],
        problemCategoryId: ids.categories[ticket.categoryKey],
        status: TicketStatus.NEW,
      },
      createdAt: ticket.createdAt,
    },
    {
      type: 'ticket.comment_added',
      actorUserId: actorId,
      payload: {
        comment: `Canonical Stage comment for fixture ${ticket.key}`,
        source: 'stage_seed',
      },
      createdAt: addMinutes(ticket.createdAt, 5),
    },
    {
      type: 'ticket.updated',
      actorUserId: ids.users.clientAdmin,
      payload: {
        fixtureKey: ticket.key,
        changes: [
          {
            field: 'priority',
            oldValue: TicketPriority.NORMAL,
            newValue: ticket.priority,
          },
        ],
      },
      createdAt: addMinutes(ticket.createdAt, 6),
    },
  ]

  if (assigneeId) {
    rows.push({
      type: 'ticket.assigned',
      actorUserId: ids.users.primaryAdmin,
      payload: {
        previousAssignedTechnicianId: null,
        assignedTechnicianId: assigneeId,
        assignerUserId: ids.users.primaryAdmin,
        mode: 'stage_seed',
      },
      createdAt: addMinutes(ticket.createdAt, 10),
    })
  }

  if (
    hasTicketStatus([
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      type: 'ticket.status_changed',
      actorUserId: assigneeId,
      payload: {
        fromStatus: TicketStatus.ASSIGNED,
        toStatus: TicketStatus.IN_PROGRESS,
        comment: 'Stage fixture work started',
      },
      createdAt: addMinutes(ticket.createdAt, 20),
    })
  }

  if (hasTicketStatus([TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE], ticket.status)) {
    rows.push({
      type: 'ticket.ready_for_acceptance',
      actorUserId: assigneeId,
      payload: {
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      },
      createdAt: addMinutes(ticket.createdAt, 40),
    })
  }

  if (ticket.status === TicketStatus.DONE) {
    rows.push({
      type: 'ticket.accepted',
      actorUserId: ids.users.clientAdmin,
      payload: {
        decision: 'ACCEPT',
        comment: 'Stage fixture accepted by client',
      },
      createdAt: addMinutes(ticket.createdAt, 60),
    })
  }

  return rows
}

async function seedTickets(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const ticketIds = CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.id)

  await prisma.$transaction([
    prisma.assignmentDecision.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticketAttachment.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticketStatusHistory.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.domainEvent.deleteMany({
      where: {
        entityType: 'Ticket',
        entityId: { in: ticketIds },
      },
    }),
  ])

  const results: SeedTicketResult[] = []

  for (const ticket of CANONICAL_STAGE_SEED.tickets) {
    await assertTicketNumberAvailable(prisma, ticket.id, ticket.ticketNumber)

    const locationId = ids.locations[ticket.locationKey]
    const createdByUserId = ids.users[ticket.createdByUserKey]
    const assignedTechnicianId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
    const lifecycle = ticketLifecycle(ticket, ids)
    const statusUpdatedAt = lifecycle[lifecycle.length - 1]?.at ?? ticket.createdAt

    const row = await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {
        ticketNumber: ticket.ticketNumber,
        companyId: ids.companies.client,
        locationId,
        problemCategoryId: ids.categories[ticket.categoryKey],
        problemText: ticket.title,
        requesterName: ticket.requesterName,
        requesterPhone: '+7 900 000-00-00',
        pointName: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.name ?? null,
        address: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.address ?? null,
        source: TicketSource.INTERNAL,
        urgency: ticket.urgency,
        priority: ticket.priority,
        status: ticket.status,
        assignedTechnicianId,
        createdByUserId,
        slaMinutes: ticket.slaMinutes,
        slaDueAt: addMinutes(ticket.createdAt, ticket.slaMinutes),
        slaBreachedAt: null,
        statusUpdatedAt,
        closedAt: ticket.status === TicketStatus.DONE ? statusUpdatedAt : null,
      },
      create: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        companyId: ids.companies.client,
        locationId,
        problemCategoryId: ids.categories[ticket.categoryKey],
        problemText: ticket.title,
        requesterName: ticket.requesterName,
        requesterPhone: '+7 900 000-00-00',
        pointName: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.name ?? null,
        address: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.address ?? null,
        source: TicketSource.INTERNAL,
        urgency: ticket.urgency,
        priority: ticket.priority,
        status: ticket.status,
        assignedTechnicianId,
        createdByUserId,
        slaMinutes: ticket.slaMinutes,
        slaDueAt: addMinutes(ticket.createdAt, ticket.slaMinutes),
        slaBreachedAt: null,
        statusUpdatedAt,
        closedAt: ticket.status === TicketStatus.DONE ? statusUpdatedAt : null,
        createdAt: ticket.createdAt,
      },
      select: { id: true, ticketNumber: true, status: true },
    })

    await prisma.ticketStatusHistory.createMany({
      data: lifecycle.map((item) => ({
        ticketId: ticket.id,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        changedByUserId: item.changedByUserId,
        comment: item.comment,
        createdAt: item.at,
      })),
    })

    const events = ticketEvents(ticket, ids)
    await prisma.domainEvent.createMany({
      data: events.map((event) => ({
        companyId: ids.companies.client,
        entityType: 'Ticket',
        entityId: ticket.id,
        type: event.type,
        actorUserId: event.actorUserId,
        payload: event.payload,
        createdAt: event.createdAt,
      })),
    })

    const requestAttachmentId = `80000000-0000-4000-8000-${ticket.ticketNumber.toString().padStart(12, '0')}`
    await prisma.ticketAttachment.create({
      data: {
        id: requestAttachmentId,
        companyId: ids.companies.client,
        ticketId: ticket.id,
        uploadedByUserId: createdByUserId,
        originalName: `stage-fixture-${ticket.key}-request.jpg`,
        storageKey: `stage-fixtures/${ticket.key}/request.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        url: `/uploads/stage-fixtures/${ticket.key}/request.jpg`,
        purpose: TicketAttachmentPurpose.REQUEST,
        createdAt: addMinutes(ticket.createdAt, 2),
      },
    })

    if (
      hasTicketStatus([
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
      ], ticket.status)
    ) {
      const reportAttachmentId = `81000000-0000-4000-8000-${ticket.ticketNumber.toString().padStart(12, '0')}`
      await prisma.ticketAttachment.create({
        data: {
          id: reportAttachmentId,
          companyId: ids.companies.client,
          ticketId: ticket.id,
          uploadedByUserId: assignedTechnicianId,
          originalName: `stage-fixture-${ticket.key}-work-report.jpg`,
          storageKey: `stage-fixtures/${ticket.key}/work-report.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          url: `/uploads/stage-fixtures/${ticket.key}/work-report.jpg`,
          purpose: TicketAttachmentPurpose.WORK_REPORT,
          createdAt: addMinutes(ticket.createdAt, 35),
        },
      })

      await prisma.domainEvent.create({
        data: {
          companyId: ids.companies.client,
          entityType: 'Ticket',
          entityId: ticket.id,
          type: 'ticket.attachment_uploaded',
          actorUserId: assignedTechnicianId,
          payload: {
            attachmentId: reportAttachmentId,
            purpose: TicketAttachmentPurpose.WORK_REPORT,
          },
          createdAt: addMinutes(ticket.createdAt, 35),
        },
      })
    }

    if (assignedTechnicianId) {
      await prisma.assignmentDecision.create({
        data: {
          ticketId: ticket.id,
          technicianId: assignedTechnicianId,
          candidatesCount: 1,
          reason: 'stage_seed',
          createdAt: addMinutes(ticket.createdAt, 10),
        },
      })
    }

    results.push({
      key: ticket.key,
      id: row.id,
      ticketNumber: row.ticketNumber,
      status: row.status,
      purpose: ticket.purpose,
    })
  }

  return results
}

async function seedPushPreferences(prisma: PrismaClient, userIds: string[]) {
  for (const userId of userIds) {
    await prisma.pushPreference.upsert({
      where: { userId },
      update: {
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
      create: {
        userId,
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
    })
  }
}

export async function runCanonicalStageSeed(
  prisma: PrismaClient,
  options?: { password?: string },
): Promise<CanonicalStageSeedResult> {
  validateCanonicalStageSeedPlan()

  const password = resolveSeedPassword(options?.password)
  const passwordHash = await bcrypt.hash(password, 10)

  await seedPermissions(prisma)

  const ids: ResolvedSeedIds = {
    companies: {} as Record<CompanyKey, string>,
    locations: {} as Record<LocationKey, string>,
    specializations: {} as Record<SpecializationKey, string>,
    categories: {} as Record<CategoryKey, string>,
    users: {} as Record<UserKey, string>,
    contracts: {},
  }

  for (const company of CANONICAL_STAGE_SEED.companies) {
    ids.companies[company.key] = await ensureCompany(prisma, company)
  }

  for (const user of CANONICAL_STAGE_SEED.users) {
    ids.users[user.key] = await ensureUser(
      prisma,
      user,
      ids.companies[user.companyKey],
      passwordHash,
    )
  }

  for (const location of CANONICAL_STAGE_SEED.locations) {
    ids.locations[location.key] = await ensureLocation(
      prisma,
      location,
      ids.companies.client,
    )
  }

  for (const specialization of CANONICAL_STAGE_SEED.specializations) {
    ids.specializations[specialization.key] = await ensureSpecialization(
      prisma,
      specialization,
      ids.companies.client,
    )
  }

  for (const category of CANONICAL_STAGE_SEED.categories) {
    ids.categories[category.key] = await ensureCategory(
      prisma,
      category,
      ids.companies.client,
      ids.specializations[category.specializationKey],
    )
  }

  for (const contract of CANONICAL_STAGE_SEED.contracts) {
    ids.contracts[contract.providerCompanyKey] = await ensureServiceContract(prisma, {
      clientCompanyId: ids.companies.client,
      providerCompanyId: ids.companies[contract.providerCompanyKey],
      role: contract.role,
      locationIds: contract.locationKeys.map((key) => ids.locations[key]),
      specializationIds: contract.specializationKeys.map((key) => ids.specializations[key]),
    })
  }

  await resetCanonicalUserScopes(prisma, ids)
  await ensureTechnicianClientBindings(prisma, ids)
  await seedPushPreferences(prisma, Object.values(ids.users))
  const tickets = await seedTickets(prisma, ids)

  const [permissionBlocks, rolePermissions] = await Promise.all([
    prisma.permissionBlock.count(),
    prisma.rolePermission.count(),
  ])

  return {
    companies: CANONICAL_STAGE_SEED.companies.length,
    users: CANONICAL_STAGE_SEED.users.length,
    locations: CANONICAL_STAGE_SEED.locations.length,
    specializations: CANONICAL_STAGE_SEED.specializations.length,
    categories: CANONICAL_STAGE_SEED.categories.length,
    contracts: CANONICAL_STAGE_SEED.contracts.length,
    tickets,
    permissionBlocks,
    rolePermissions,
    providerDelegation: 'not_supported_by_current_schema',
  }
}

function printDryRun() {
  validateCanonicalStageSeedPlan()
  const statuses = unique(CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.status))
  console.log('[seed-stage-canonical] dry-run OK')
  console.log(`[seed-stage-canonical] companies: ${CANONICAL_STAGE_SEED.companies.length}`)
  console.log(`[seed-stage-canonical] users: ${CANONICAL_STAGE_SEED.users.length}`)
  console.log(`[seed-stage-canonical] contracts: ${CANONICAL_STAGE_SEED.contracts.length}`)
  console.log(`[seed-stage-canonical] tickets: ${CANONICAL_STAGE_SEED.tickets.length}`)
  console.log(`[seed-stage-canonical] statuses: ${statuses.join(', ')}`)
  console.log('[seed-stage-canonical] providerDelegation: not supported by current schema')
}

async function main() {
  if (process.env.STAGE_CANONICAL_SEED_DRY_RUN === '1') {
    printDryRun()
    return
  }

  const prisma = new PrismaClient()
  try {
    const result = await runCanonicalStageSeed(prisma)
    console.log('[seed-stage-canonical] complete')
    console.log(`[seed-stage-canonical] companies: ${result.companies}`)
    console.log(`[seed-stage-canonical] users: ${result.users}`)
    console.log(`[seed-stage-canonical] locations: ${result.locations}`)
    console.log(`[seed-stage-canonical] specializations: ${result.specializations}`)
    console.log(`[seed-stage-canonical] categories: ${result.categories}`)
    console.log(`[seed-stage-canonical] contracts: ${result.contracts}`)
    console.log(`[seed-stage-canonical] PermissionBlock: ${result.permissionBlocks}`)
    console.log(`[seed-stage-canonical] RolePermission: ${result.rolePermissions}`)
    for (const ticket of result.tickets) {
      console.log(
        `[seed-stage-canonical] fixture ${ticket.key}: #${ticket.ticketNumber} ${ticket.status} — ${ticket.purpose}`,
      )
    }
    console.log('[seed-stage-canonical] providerDelegation: not supported by current schema')
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[seed-stage-canonical] failed', error)
    process.exit(1)
  })
}
