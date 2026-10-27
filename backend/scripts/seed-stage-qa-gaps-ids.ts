/**
 * Deterministic IDs and labels for Stage QA gap fixtures.
 */

export const GAP_IDS = {
  company: {
    platform: '10000000-0000-4000-8000-000000001010',
    foreignClient: '10000000-0000-4000-8000-000000001011',
    foreignSecondary: '10000000-0000-4000-8000-000000001012',
  },
  location: {
    foreign: '30000000-0000-4000-8000-000000001011',
  },
  specialization: {
    foreignElectrical: '40000000-0000-4000-8000-000000001011',
  },
  category: {
    foreignElectrical: '41000000-0000-4000-8000-000000001011',
  },
  user: {
    platformAdmin: '20000000-0000-4000-8000-000000001301',
    foreignClientAdmin: '20000000-0000-4000-8000-000000001302',
    foreignSecondaryAdmin: '20000000-0000-4000-8000-000000001303',
  },
  ticket: {
    canceled: '50000000-0000-4000-8000-000000001011',
    foreign: '50000000-0000-4000-8000-000000001012',
  },
  contract: {
    foreignInactiveOnMain: '60000000-0000-4000-8000-000000001011',
    foreignActiveOnForeignClient: '60000000-0000-4000-8000-000000001012',
  },
  maxBinding: {
    secondaryTechnician: '90000000-0000-4000-8000-000000001001',
    mobileTechnician: '90000000-0000-4000-8000-000000001002',
  },
} as const

export const STAGE_QA_GAP_FIXTURES = {
  platformAdminEmail: 'stage.platform.admin@stage.local',
  foreignClientAdminEmail: 'stage.foreign.client.admin@stage.local',
  foreignSecondaryAdminEmail: 'stage.foreign.secondary.admin@stage.local',
  canceledTicketNumber: 9111,
  foreignTicketNumber: 9112,
  syntheticMaxUserIds: {
    secondaryTechnician: 'stage-seed-max-user-secondary-tech',
    mobileTechnician: 'stage-seed-max-user-mobile-tech',
  },
  ids: GAP_IDS,
} as const
