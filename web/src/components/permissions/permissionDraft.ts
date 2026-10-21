/** Shared types/helpers for the permission draft editor (UI-only, no API writes). */
export type DraftMap = Record<string, string[]>

export type EntryChange = {
  role: string
  companyType: 'CLIENT' | 'PROVIDER' | null
  add: string[]
  remove: string[]
}

export function entryKey(role: string, companyType: 'CLIENT' | 'PROVIDER' | null): string {
  return `${role}:${companyType ?? 'ANY'}`
}
