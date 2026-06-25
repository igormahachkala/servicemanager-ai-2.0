export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed'

export type ProjectRisk = {
  id: string
  title: string
  description: string
  severity: RiskSeverity
  status: RiskStatus
  mitigation: string
}

export type CreateProjectRiskInput = {
  title: string
  description?: string
  severity?: RiskSeverity
  status?: RiskStatus
  mitigation?: string
}

const RISK_SEVERITIES: RiskSeverity[] = ['low', 'medium', 'high', 'critical']
const RISK_STATUSES: RiskStatus[] = ['open', 'mitigated', 'accepted', 'closed']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSeverity(value: unknown): RiskSeverity {
  if (typeof value === 'string' && RISK_SEVERITIES.includes(value as RiskSeverity)) {
    return value as RiskSeverity
  }
  return 'medium'
}

function parseRiskStatus(value: unknown): RiskStatus {
  if (typeof value === 'string' && RISK_STATUSES.includes(value as RiskStatus)) {
    return value as RiskStatus
  }
  return 'open'
}

export function parseProjectRisk(value: unknown): ProjectRisk | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    severity: parseSeverity(value.severity),
    status: parseRiskStatus(value.status),
    mitigation: typeof value.mitigation === 'string' ? value.mitigation : '',
  }
}

export function createProjectRisk(input: CreateProjectRiskInput): ProjectRisk {
  return {
    id: `risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    severity: input.severity ?? 'medium',
    status: input.status ?? 'open',
    mitigation: (input.mitigation ?? '').trim(),
  }
}

export { RISK_SEVERITIES, RISK_STATUSES }
