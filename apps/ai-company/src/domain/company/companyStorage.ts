import {
  COMPANY_INDUSTRIES,
  COMPANY_STATUSES,
  DEFAULT_COMPANY_ID,
  type Company,
  type CompanyBranding,
  type CompanyIndustry,
  type CompanyStatus,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from './company'

const STORAGE_KEY = 'ai-company-companies'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseIndustry(value: unknown): CompanyIndustry {
  if (typeof value === 'string' && (COMPANY_INDUSTRIES as readonly string[]).includes(value)) {
    return value as CompanyIndustry
  }
  return 'technology'
}

function parseStatus(value: unknown): CompanyStatus {
  if (typeof value === 'string' && (COMPANY_STATUSES as readonly string[]).includes(value)) {
    return value as CompanyStatus
  }
  return 'active'
}

function parseBranding(value: unknown): CompanyBranding {
  if (!isRecord(value)) {
    return { primaryColor: '#6366f1', logoUrl: null, tagline: '' }
  }
  return {
    primaryColor: typeof value.primaryColor === 'string' ? value.primaryColor : '#6366f1',
    logoUrl: typeof value.logoUrl === 'string' ? value.logoUrl : null,
    tagline: typeof value.tagline === 'string' ? value.tagline : '',
  }
}

function parseCompany(value: unknown): Company | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.slug !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description: value.description,
    owner: typeof value.owner === 'string' ? value.owner : '',
    industry: parseIndustry(value.industry),
    country: typeof value.country === 'string' ? value.country : '',
    timezone: typeof value.timezone === 'string' ? value.timezone : 'UTC',
    branding: parseBranding(value.branding),
    status: parseStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function slugifyCompanyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'company'
  )
}

function uniqueSlug(base: string, companies: Company[], excludeId?: string): string {
  let slug = base
  let index = 1
  while (companies.some((item) => item.slug === slug && item.id !== excludeId)) {
    slug = `${base}-${index}`
    index += 1
  }
  return slug
}

export function loadCompanies(): Company[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseCompany).filter((item): item is Company => item !== null)
  } catch {
    return []
  }
}

export function saveCompanies(companies: Company[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies))
  } catch {
    /* noop */
  }
}

export function getCompanyById(id: string): Company | null {
  return loadCompanies().find((item) => item.id === id) ?? null
}

export function getCompanyBySlug(slug: string): Company | null {
  return loadCompanies().find((item) => item.slug === slug) ?? null
}

export function createCompany(input: CreateCompanyInput): Company {
  const now = new Date().toISOString()
  const companies = loadCompanies()
  const baseSlug = slugifyCompanyName(input.slug?.trim() || input.name)
  const slug = uniqueSlug(baseSlug, companies)

  const company: Company = {
    id: `company-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    slug,
    description: (input.description ?? '').trim(),
    owner: (input.owner ?? '').trim(),
    industry: input.industry ?? 'technology',
    country: (input.country ?? '').trim(),
    timezone: input.timezone ?? 'UTC',
    branding: {
      primaryColor: input.branding?.primaryColor ?? '#6366f1',
      logoUrl: input.branding?.logoUrl ?? null,
      tagline: (input.branding?.tagline ?? '').trim(),
    },
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }

  saveCompanies([...companies, company])
  return company
}

export function updateCompany(id: string, patch: UpdateCompanyInput): Company | null {
  const companies = loadCompanies()
  const index = companies.findIndex((item) => item.id === id)
  if (index === -1) return null

  const current = companies[index]
  const now = new Date().toISOString()
  const nextSlug =
    patch.slug !== undefined
      ? uniqueSlug(slugifyCompanyName(patch.slug), companies, id)
      : current.slug

  const updated: Company = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    slug: nextSlug,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    owner: patch.owner !== undefined ? patch.owner.trim() : current.owner,
    industry: patch.industry ?? current.industry,
    country: patch.country !== undefined ? patch.country.trim() : current.country,
    timezone: patch.timezone ?? current.timezone,
    branding: patch.branding ? { ...current.branding, ...patch.branding } : current.branding,
    status: patch.status ?? current.status,
    updatedAt: now,
  }

  const next = [...companies]
  next[index] = updated
  saveCompanies(next)
  return updated
}

export function ensureSeedCompanies(): Company[] {
  const existing = loadCompanies()
  if (existing.length > 0) return existing

  const now = new Date().toISOString()
  const seeds: Company[] = [
    {
      id: DEFAULT_COMPANY_ID,
      name: 'AI Company Platform',
      slug: 'ai-company-platform',
      description:
        'Default tenant — digital workforce, workspaces, and runtime orchestration for the Owner.',
      owner: 'Owner',
      industry: 'technology',
      country: 'RU',
      timezone: 'Europe/Moscow',
      branding: {
        primaryColor: '#6366f1',
        logoUrl: null,
        tagline: 'Mission Control for AI workforce',
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'company-servicemanager',
      name: 'ServiceManager',
      slug: 'servicemanager',
      description: 'Field service operations — tickets, technicians, and client workflows.',
      owner: 'Owner',
      industry: 'technology',
      country: 'RU',
      timezone: 'Europe/Moscow',
      branding: {
        primaryColor: '#10b981',
        logoUrl: null,
        tagline: 'Service operations platform',
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]

  saveCompanies(seeds)
  return seeds
}

export { COMPANY_INDUSTRIES, COMPANY_STATUSES, DEFAULT_COMPANY_ID } from './company'
export { DEFAULT_TIMEZONES } from './company'
