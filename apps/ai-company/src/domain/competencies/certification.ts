export type CertificationStatus = 'planned' | 'in_progress' | 'completed' | 'expired'

export type Certification = {
  id: string
  title: string
  issuer: string
  status: CertificationStatus
  completedAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): CertificationStatus {
  if (
    value === 'planned' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'expired'
  ) {
    return value
  }
  return 'planned'
}

export function parseCertification(value: unknown): Certification | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.issuer !== 'string') {
    return null
  }

  return {
    id: value.id,
    title: value.title,
    issuer: value.issuer,
    status: parseStatus(value.status),
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
  }
}

export function createCertification(input: Omit<Certification, 'id'> & { id?: string }): Certification {
  return {
    id: input.id ?? `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    issuer: input.issuer.trim(),
    status: input.status,
    completedAt: input.completedAt,
  }
}
