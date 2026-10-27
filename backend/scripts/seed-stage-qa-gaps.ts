/**
 * Critical Stage QA gaps on top of CANONICAL_STAGE_SEED.
 *
 * Covers: PLATFORM_ADMIN, foreign CLIENT isolation, foreign SECONDARY with
 * INACTIVE contract to main client, CANCELED ticket, synthetic MaxUserBinding.
 *
 * Does not register MAX webhooks or touch polling. MaxUserBinding rows use
 * synthetic maxUserId values under the stage-seed-* prefix.
 *
 * Split: IDs in seed-stage-qa-gaps-ids.ts, entity helpers in
 * seed-stage-qa-gaps-entities.ts. Canonical runner seed-stage-qa.ts remains
 * oversized (>800) and needs a later fixtures/guard/tickets split.
 */

import {
  CompanyType,
  PrismaClient,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client'

import {
  ensureCategory,
  ensureCompany,
  ensureContractById,
  ensureLocation,
  ensureMaxUserBinding,
  ensureSpecialization,
  ensureUser,
  ensureUserSelectedScope,
  seedCanceledTicket,
  seedForeignTicket,
} from './seed-stage-qa-gaps-entities'
import { GAP_IDS, STAGE_QA_GAP_FIXTURES } from './seed-stage-qa-gaps-ids'

export { STAGE_QA_GAP_FIXTURES, GAP_IDS } from './seed-stage-qa-gaps-ids'

export type CanonicalStageGapsContext = {
  mainClientCompanyId: string
  secondaryProviderCompanyId: string
  clientAdminUserId: string
  secondaryTechnicianUserId: string
  mobileTechnicianUserId: string
  primaryLocationId: string
  hvacCategoryId: string
  canonicalUserEmails: readonly string[]
  canonicalTicketNumbers: readonly number[]
}

export type StageQaGapsSeedResult = {
  platformAdminEmail: string
  foreignClientId: string
  foreignSecondaryProviderId: string
  canceledTicketId: string
  foreignTicketId: string
  maxUserBindings: number
  inactiveContracts: number
}

/**
 * Requires canonical Stage companies/users/locations/categories already present.
 */
export async function seedCanonicalStageGaps(
  prisma: PrismaClient,
  passwordHash: string,
  context: CanonicalStageGapsContext,
): Promise<StageQaGapsSeedResult> {
  validateCanonicalStageGapsPlan(context)

  const platformCompanyId = await ensureCompany(prisma, {
    id: GAP_IDS.company.platform,
    name: 'SMA Stage Canonical Platform',
    type: CompanyType.PROVIDER,
  })

  const platformAdminId = await ensureUser(prisma, {
    id: GAP_IDS.user.platformAdmin,
    email: STAGE_QA_GAP_FIXTURES.platformAdminEmail,
    firstName: 'Stage Platform',
    lastName: 'Admin',
    role: UserRole.PLATFORM_ADMIN,
    companyId: platformCompanyId,
    passwordHash,
  })

  await ensureUserSelectedScope(prisma, {
    userId: platformAdminId,
    companyId: platformCompanyId,
    locationIds: [],
    specializationIds: [],
  })

  const foreignClientId = await ensureCompany(prisma, {
    id: GAP_IDS.company.foreignClient,
    name: 'SMA Stage Foreign Client B',
    type: CompanyType.CLIENT,
  })

  const foreignSecondaryId = await ensureCompany(prisma, {
    id: GAP_IDS.company.foreignSecondary,
    name: 'SMA Stage Foreign Secondary Provider B',
    type: CompanyType.PROVIDER,
  })

  const foreignClientAdminId = await ensureUser(prisma, {
    id: GAP_IDS.user.foreignClientAdmin,
    email: STAGE_QA_GAP_FIXTURES.foreignClientAdminEmail,
    firstName: 'Stage Foreign',
    lastName: 'Client Admin',
    role: UserRole.ADMIN,
    companyId: foreignClientId,
    passwordHash,
  })

  const foreignSecondaryAdminId = await ensureUser(prisma, {
    id: GAP_IDS.user.foreignSecondaryAdmin,
    email: STAGE_QA_GAP_FIXTURES.foreignSecondaryAdminEmail,
    firstName: 'Stage Foreign',
    lastName: 'Secondary Admin',
    role: UserRole.ADMIN,
    companyId: foreignSecondaryId,
    passwordHash,
  })

  const foreignLocationId = await ensureLocation(prisma, {
    id: GAP_IDS.location.foreign,
    clientCompanyId: foreignClientId,
    platformCode: 'SMA-QA-FOREIGN-B',
    name: 'SMA QA Foreign Client B Location',
    city: 'Новосибирск',
    address: 'Новосибирск, Stage QA Foreign B, 1',
  })

  const foreignSpecializationId = await ensureSpecialization(prisma, {
    id: GAP_IDS.specialization.foreignElectrical,
    companyId: foreignClientId,
    name: 'Stage QA Foreign Electrical',
  })

  const foreignCategoryId = await ensureCategory(prisma, {
    id: GAP_IDS.category.foreignElectrical,
    companyId: foreignClientId,
    name: 'Stage QA Foreign Electrical category',
    specializationId: foreignSpecializationId,
  })

  await ensureUserSelectedScope(prisma, {
    userId: foreignClientAdminId,
    companyId: foreignClientId,
    locationIds: [foreignLocationId],
    specializationIds: [foreignSpecializationId],
  })

  await ensureUserSelectedScope(prisma, {
    userId: foreignSecondaryAdminId,
    companyId: foreignSecondaryId,
    locationIds: [foreignLocationId],
    specializationIds: [foreignSpecializationId],
  })

  await ensureContractById(prisma, {
    id: GAP_IDS.contract.foreignInactiveOnMain,
    clientCompanyId: context.mainClientCompanyId,
    providerCompanyId: foreignSecondaryId,
    role: ServiceContractRole.SECONDARY,
    status: ServiceContractStatus.INACTIVE,
    locationIds: [],
    specializationIds: [],
    notes: 'Stage gap: inactive foreign SECONDARY on main CLIENT (negative)',
  })

  await ensureContractById(prisma, {
    id: GAP_IDS.contract.foreignActiveOnForeignClient,
    clientCompanyId: foreignClientId,
    providerCompanyId: foreignSecondaryId,
    role: ServiceContractRole.SECONDARY,
    status: ServiceContractStatus.ACTIVE,
    locationIds: [foreignLocationId],
    specializationIds: [foreignSpecializationId],
    notes: 'Stage gap: ACTIVE foreign SECONDARY only on foreign CLIENT B',
  })

  const canceledTicketId = await seedCanceledTicket(prisma, {
    mainClientCompanyId: context.mainClientCompanyId,
    locationId: context.primaryLocationId,
    categoryId: context.hvacCategoryId,
    createdByUserId: context.clientAdminUserId,
  })

  const foreignTicketId = await seedForeignTicket(prisma, {
    foreignClientCompanyId: foreignClientId,
    locationId: foreignLocationId,
    categoryId: foreignCategoryId,
    createdByUserId: foreignClientAdminId,
  })

  const maxBindingIds = await Promise.all([
    ensureMaxUserBinding(prisma, {
      id: GAP_IDS.maxBinding.secondaryTechnician,
      userId: context.secondaryTechnicianUserId,
      companyId: context.secondaryProviderCompanyId,
      maxUserId: STAGE_QA_GAP_FIXTURES.syntheticMaxUserIds.secondaryTechnician,
    }),
    ensureMaxUserBinding(prisma, {
      id: GAP_IDS.maxBinding.mobileTechnician,
      userId: context.mobileTechnicianUserId,
      companyId: context.secondaryProviderCompanyId,
      maxUserId: STAGE_QA_GAP_FIXTURES.syntheticMaxUserIds.mobileTechnician,
    }),
  ])

  return {
    platformAdminEmail: STAGE_QA_GAP_FIXTURES.platformAdminEmail,
    foreignClientId,
    foreignSecondaryProviderId: foreignSecondaryId,
    canceledTicketId,
    foreignTicketId,
    maxUserBindings: maxBindingIds.length,
    inactiveContracts: 1,
  }
}

export function validateCanonicalStageGapsPlan(context: CanonicalStageGapsContext) {
  const emails = [
    STAGE_QA_GAP_FIXTURES.platformAdminEmail,
    STAGE_QA_GAP_FIXTURES.foreignClientAdminEmail,
    STAGE_QA_GAP_FIXTURES.foreignSecondaryAdminEmail,
  ]
  const canonicalEmails = new Set(
    context.canonicalUserEmails.map((email) => email.trim().toLowerCase()),
  )
  for (const email of emails) {
    if (canonicalEmails.has(email.trim().toLowerCase())) {
      throw new Error(`[seed-stage-gaps] email collides with canonical user: ${email}`)
    }
  }

  const canonicalTicketNumbers = new Set(context.canonicalTicketNumbers)
  for (const ticketNumber of [
    STAGE_QA_GAP_FIXTURES.canceledTicketNumber,
    STAGE_QA_GAP_FIXTURES.foreignTicketNumber,
  ]) {
    if (canonicalTicketNumbers.has(ticketNumber)) {
      throw new Error(`[seed-stage-gaps] ticket number collides with canonical: ${ticketNumber}`)
    }
  }
}
