export const COMPANY_STATUSES = ['draft', 'active', 'suspended', 'archived'] as const

export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export const COMPANY_INDUSTRIES = [
  'technology',
  'retail',
  'finance',
  'healthcare',
  'manufacturing',
  'other',
] as const

export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number]

export type CompanyBranding = {
  primaryColor: string
  logoUrl: string | null
  tagline: string
}

export type Company = {
  id: string
  name: string
  slug: string
  description: string
  owner: string
  industry: CompanyIndustry
  country: string
  timezone: string
  branding: CompanyBranding
  status: CompanyStatus
  createdAt: string
  updatedAt: string
}

export type CreateCompanyInput = {
  name: string
  slug?: string
  description?: string
  owner?: string
  industry?: CompanyIndustry
  country?: string
  timezone?: string
  branding?: Partial<CompanyBranding>
  status?: CompanyStatus
}

export type UpdateCompanyInput = Partial<
  Pick<
    Company,
    'name' | 'slug' | 'description' | 'owner' | 'industry' | 'country' | 'timezone' | 'branding' | 'status'
  >
>

export const DEFAULT_COMPANY_ID = 'company-ai-company'

export const DEFAULT_TIMEZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
] as const
