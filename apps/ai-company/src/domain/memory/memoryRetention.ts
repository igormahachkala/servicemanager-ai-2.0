export const MEMORY_RETENTION_POLICIES = ['session', 'short', 'long', 'permanent'] as const

export type MemoryRetention = (typeof MEMORY_RETENTION_POLICIES)[number]

export const RETENTION_DAYS_HINT: Record<MemoryRetention, number | null> = {
  session: 1,
  short: 30,
  long: 365,
  permanent: null,
}

/** Future: retention enforcement runs outside Runtime — policy stored with entry. */
export const RETENTION_FUTURE_NOTE = 'Retention policies are declarative in V1 — no automatic purge.';
