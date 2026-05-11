/**
 * Stage 1: split web/src/lib/api.ts → web/src/lib/api/*.ts
 * Run: node web/scripts/split-api-layer.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcPath = path.join(root, 'src/lib/api.ts')
const outDir = path.join(root, 'src/lib/api')

const raw = fs.readFileSync(srcPath, 'utf8')
const lines = raw.split(/\r?\n/)

function sliceLine(a, b) {
  return lines.slice(a - 1, b).join('\n')
}

fs.mkdirSync(outDir, { recursive: true })

// ---------- types.ts ----------
const typesParts = [
  sliceLine(1, 13),
  sliceLine(19, 73),
  sliceLine(141, 411),
  sliceLine(422, 1029),
  sliceLine(1047, 1051),
  sliceLine(1313, 1313),
  sliceLine(1948, 1951),
  sliceLine(2253, 2519),
  sliceLine(2652, 2707),
].join('\n\n')

fs.writeFileSync(
  path.join(outDir, 'types.ts'),
  `/** DTO / API types (Stage 1 split). */\n\n${typesParts}\n`,
  'utf8',
)

// ---------- constants.ts ----------
const notifConst = sliceLine(74, 86).replace(
  /^const NOTIFICATION_TYPE_LABELS/m,
  'export const NOTIFICATION_TYPE_LABELS',
)
const storageKeys = sliceLine(1031, 1042)
  .split('\n')
  .map((ln) => (ln.startsWith('const ') ? 'export ' + ln : ln))
  .join('\n')

fs.writeFileSync(
  path.join(outDir, 'constants.ts'),
  `/** Static keys and lookup tables. */\n\n${notifConst}\n\n${storageKeys}\n\nexport const FALLBACK_API_BASE_URL = 'http://localhost:3000'\n`,
  'utf8',
)

// ---------- mappers.ts ----------
fs.writeFileSync(
  path.join(outDir, 'mappers.ts'),
  `import { NOTIFICATION_TYPE_LABELS } from './constants'

export function getNotificationTypeLabel(type: string): string {
  const t = (type || '').trim()
  if (!t) return 'Уведомление'
  return NOTIFICATION_TYPE_LABELS[t] || t
}

${sliceLine(98, 113)}

${sliceLine(115, 139)}
`,
  'utf8',
)

// ---------- role-utils.ts (pure helpers; no ./client import) ----------
fs.writeFileSync(
  path.join(outDir, 'role-utils.ts'),
  `import type { LinkedClientSummary, Me, TechnicianBoundContext, TicketGetOne } from './types'

${sliceLine(15, 17)}

${sliceLine(414, 420)}

${sliceLine(1235, 1238)}

${sliceLine(1246, 1311)}

${sliceLine(1344, 1351)}

${sliceLine(1518, 1525)}
`,
  'utf8',
)

// ---------- client.ts (session + fetch + scope; no domain endpoints) ----------
const clientPartA = sliceLine(1053, 1516)
const clientPartB = sliceLine(1527, 1599)
const clientPartC = `${sliceLine(1941, 1946)}\n\n${sliceLine(1953, 1967)}\n`
let clientCore = `${clientPartA}\n\n${clientPartB}\n\n${clientPartC}\n`
clientCore = clientCore.replace(/^async function request</m, 'export async function request<')
clientCore = clientCore.replace(/^function normalizeArrayResponse</m, 'export function normalizeArrayResponse<')
clientCore = clientCore.replace(/^function buildTicketScopeSuffix/m, 'export function buildTicketScopeSuffix')

fs.writeFileSync(
  path.join(outDir, 'client.ts'),
  `import type {
  ImpersonateResponse,
  ImpersonationMeta,
  Me,
  Role,
  TechnicianMobileLinkedSource,
  TicketScopeParams,
} from './types'
import {
  BASE_URL_KEY,
  COMPANY_LABEL_KEY,
  FALLBACK_API_BASE_URL,
  IMPERSONATION_META_KEY,
  LAST_SCOPE_KEY,
  PLATFORM_BACKUP_COMPANY_LABEL_KEY,
  PLATFORM_BACKUP_KEY,
  PLATFORM_BACKUP_ROLE_KEY,
  SCOPE_OWNER_COMPANY_ID_KEY,
  SCOPE_OWNER_ROLE_KEY,
  SCOPE_OWNER_USER_ID_KEY,
  TOKEN_KEY,
  USER_ROLE_KEY,
} from './constants'

${clientCore}
`,
  'utf8',
)

// ---------- notifications.ts ----------
fs.writeFileSync(
  path.join(outDir, 'notifications.ts'),
  `import { request } from './client'
import type { NotificationsListResponse } from './types'

${sliceLine(1624, 1638)}
`,
  'utf8',
)

// ---------- users.ts ----------
fs.writeFileSync(
  path.join(outDir, 'users.ts'),
  `import { request, normalizeArrayResponse } from './client'
import type {
  CreateProblemCategoryInput,
  CreateSpecializationInput,
  CreateUserInput,
  LoginInput,
  LoginResponse,
  Me,
  ProblemCategoryListItem,
  SpecializationListItem,
  UpdateProblemCategoryInput,
  UpdateSpecializationInput,
  UpdateUserInput,
  UserListItem,
} from './types'

${sliceLine(1602, 1622)}
${sliceLine(1640, 1751)}
`,
  'utf8',
)

// ---------- technicians.ts (includes local isUuid) ----------
fs.writeFileSync(
  path.join(outDir, 'technicians.ts'),
  `import { request } from './client'
import type {
  TechnicianBoundContext,
  TechnicianItem,
  TechnicianLocationBindingsResponse,
  TechnicianWorkloadItem,
} from './types'

${sliceLine(1753, 1812)}
`,
  'utf8',
)

// ---------- company.ts ----------
fs.writeFileSync(
  path.join(outDir, 'company.ts'),
  `import { request } from './client'
import type {
  CompanySettings,
  CreateCompanyAdminInput,
  CreateCompanyInput,
  CreateServiceContractInput,
  LinkedClientSummary,
  PlatformCompanyItem,
  ServiceContractItem,
  UpdateCompanyInput,
  UpdateServiceContractInput,
  UserListItem,
} from './types'

${sliceLine(1814, 1885)}
${sliceLine(1921, 1946)}
`,
  'utf8',
)

// ---------- locations.ts ----------
fs.writeFileSync(
  path.join(outDir, 'locations.ts'),
  `import { request, normalizeArrayResponse } from './client'
import type {
  CreateLocationInput,
  EquipmentListItem,
  LocationListItem,
  UpdateLocationInput,
} from './types'

${sliceLine(1888, 1919)}
${sliceLine(2521, 2523)}
`,
  'utf8',
)

// ---------- board.ts ----------
fs.writeFileSync(
  path.join(outDir, 'board.ts'),
  `import { request } from './client'
import type { BoardResponse, TicketStatus } from './types'

${sliceLine(1969, 2004)}
`,
  'utf8',
)

// ---------- tickets.ts ----------
fs.writeFileSync(
  path.join(outDir, 'tickets.ts'),
  `import { buildTicketScopeSuffix, getBaseUrl, getToken, request } from './client'
import type {
  AssignmentCandidatesResponse,
  AssignmentDecisionItem,
  CreateChildTicketInput,
  CreateTicketInput,
  CreateTicketResponse,
  DraftTicketAttachment,
  SmartAssignResult,
  TicketAttachmentItem,
  TicketGetOne,
  TicketScopeParams,
  TimelineResponse,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from './types'

${sliceLine(2006, 2215)}
`,
  'utf8',
)

// ---------- map-analytics.ts ----------
fs.writeFileSync(
  path.join(outDir, 'map-analytics.ts'),
  `import { request } from './client'
import type {
  AnalyticsOverviewResponse,
  MapLocationDetail,
  MapLocationItem,
  TicketContextAnalyticsResponse,
} from './types'

${sliceLine(2217, 2250)}
`,
  'utf8',
)

// ---------- inspections.ts ----------
fs.writeFileSync(
  path.join(outDir, 'inspections.ts'),
  `import { getBaseUrl, getToken, request } from './client'
import type {
  CompleteInspectionRunResponse,
  CreateTicketFromInspectionItemInput,
  CreateTicketResponse,
  InspectionRun,
  InspectionRunItem,
  InspectionRunItemAttachment,
  InspectionRunListItem,
  InspectionRunReport,
  InspectionTemplate,
  ReviewInspectionRunReportInput,
  StartInspectionRunInput,
  TicketStatus,
  TicketUrgency,
  UpdateInspectionRunItemInput,
} from './types'

${sliceLine(2525, 2651)}
${sliceLine(2778, 2816)}
`,
  'utf8',
)

// ---------- public.ts ----------
fs.writeFileSync(
  path.join(outDir, 'public.ts'),
  `import { getBaseUrl, request } from './client'
import type {
  PublicQuickRequestInput,
  PublicQuickRequestResponse,
  PublicRequestContext,
  PublicRequestEquipment,
  PublicRequestLocation,
} from './types'

${sliceLine(2709, 2774)}
`,
  'utf8',
)

// ---------- index.ts ----------
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `export * from './types'
export * from './constants'
export * from './mappers'
export * from './role-utils'
export * from './client'
export * from './notifications'
export * from './users'
export * from './technicians'
export * from './company'
export * from './locations'
export * from './board'
export * from './tickets'
export * from './map-analytics'
export * from './inspections'
export * from './public'
`,
  'utf8',
)

console.log('OK:', outDir)

if (process.argv.includes('--apply-barrel')) {
  const barrelPath = path.join(root, 'src/lib/api.ts')
  fs.writeFileSync(barrelPath, "export * from './api/index'\n", 'utf8')
  console.log('Wrote barrel:', barrelPath)
}
