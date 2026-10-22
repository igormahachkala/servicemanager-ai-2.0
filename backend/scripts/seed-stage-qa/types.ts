import { CompanyType, TicketPriority, TicketStatus, TicketUrgency, UserRole } from '@prisma/client'

import { IDS } from './constants'

export type ParsedDatabaseUrlIdentity = {
  status: 'missing' | 'malformed' | 'unsupported_protocol' | 'parsed'
  protocol: string | null
  host: string | null
  port: string | null
  database: string | null
  schema: string | null
}

export type ConfirmationIdentity = 'missing' | 'invalid' | 'valid'

export type ConnectedDatabaseIdentityStatus = 'not_checked' | 'checked' | 'failed'

export type StageQaSeedTargetIdentity = {
  confirmation: ConfirmationIdentity
  releaseEnvironment: string | null
  nodeEnvironment: string | null
  databaseUrl: ParsedDatabaseUrlIdentity
  connectedDatabaseStatus: ConnectedDatabaseIdentityStatus
  connectedDatabase: string | null
}

export type StageQaSeedGuardEvaluation = {
  allowed: boolean
  identity: StageQaSeedTargetIdentity
  failures: string[]
}

export type CompanyKey = keyof typeof IDS.company
export type LocationKey = keyof typeof IDS.location
export type SpecializationKey = keyof typeof IDS.specialization
export type CategoryKey = keyof typeof IDS.category
export type UserKey = keyof typeof IDS.user
export type StageFixtureKey = keyof typeof IDS.ticket

export type CanonicalCompany = {
  key: CompanyKey
  id: string
  name: string
  type: CompanyType
}

export type CanonicalUser = {
  key: UserKey
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  companyKey: CompanyKey
  isExecutor: boolean
}

export type CanonicalLocation = {
  key: LocationKey
  id: string
  platformCode: string
  name: string
  city: string
  address: string
}

export type CanonicalSpecialization = {
  key: SpecializationKey
  id: string
  name: string
}

export type CanonicalCategory = {
  key: CategoryKey
  id: string
  name: string
  specializationKey: SpecializationKey
}

export type CanonicalTicket = {
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

export type ResolvedSeedIds = {
  companies: Record<CompanyKey, string>
  locations: Record<LocationKey, string>
  specializations: Record<SpecializationKey, string>
  categories: Record<CategoryKey, string>
  users: Record<UserKey, string>
  contracts: Partial<Record<'primaryProvider' | 'secondaryProvider', string>>
}

export type SeedTicketResult = {
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
