import { DEFAULT_COMPANY_ID } from '../company/company'
import type { RuntimeReportBody, RuntimeReportRisk, ReportSeverity } from '../runtimeReport/runtimeReportQuality'
import { REPORT_STATUSES, REPORT_TYPES } from './reportTypes'
import type { ReportStatus, ReportType } from './reportTypes'
import type { Report, ReportEvidence, ReportFilter } from './report'

const STORAGE_KEY = 'ai-company-reports'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseReportType(value: unknown): ReportType | null {
  return typeof value === 'string' && (REPORT_TYPES as readonly string[]).includes(value)
    ? (value as ReportType)
    : null
}

function parseReportStatus(value: unknown): ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value)
    ? (value as ReportStatus)
    : 'draft'
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseSeverity(value: unknown): ReportSeverity {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
    return value
  }
  return 'medium'
}

function parseRuntimeReportRisk(value: unknown): RuntimeReportRisk | null {
  if (!isRecord(value) || typeof value.message !== 'string') return null
  return {
    severity: parseSeverity(value.severity),
    message: value.message,
  }
}

function parseRuntimeReportBody(value: unknown): RuntimeReportBody | null {
  if (!isRecord(value)) return null
  if (typeof value.briefSummary !== 'string' || typeof value.formattedMarkdown !== 'string') {
    return null
  }

  const risks = Array.isArray(value.risks)
    ? value.risks.map(parseRuntimeReportRisk).filter((item): item is RuntimeReportRisk => item !== null)
    : []

  return {
    briefSummary: value.briefSummary,
    checked: parseStringArray(value.checked),
    found: parseStringArray(value.found),
    risks,
    recommendations: parseStringArray(value.recommendations),
    nextStep: typeof value.nextStep === 'string' ? value.nextStep : '',
    ownerDecisionRequired:
      typeof value.ownerDecisionRequired === 'string' ? value.ownerDecisionRequired : null,
    formattedMarkdown: value.formattedMarkdown,
  }
}

function parseEvidence(value: unknown): ReportEvidence[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): ReportEvidence | null => {
      if (!isRecord(item)) return null
      const kind =
        item.kind === 'link' ||
        item.kind === 'artifact' ||
        item.kind === 'quote' ||
        item.kind === 'metric'
          ? item.kind
          : 'quote'
      if (typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.value !== 'string') {
        return null
      }
      return { id: item.id, label: item.label, kind, value: item.value }
    })
    .filter((item): item is ReportEvidence => item !== null)
}

function parseReport(value: unknown): Report | null {
  if (!isRecord(value)) return null
  const type = parseReportType(value.type)
  if (
    !type ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    companyId: typeof value.companyId === 'string' ? value.companyId : '',
    title: value.title,
    type,
    employeeId: typeof value.employeeId === 'string' ? value.employeeId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    summary: value.summary,
    findings: parseStringArray(value.findings),
    risks: parseStringArray(value.risks),
    recommendations: parseStringArray(value.recommendations),
    evidence: parseEvidence(value.evidence),
    status: parseReportStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    runtimeBody: parseRuntimeReportBody(value.runtimeBody),
  }
}

export function loadReports(): Report[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseReport).filter((item): item is Report => item !== null)
  } catch {
    return []
  }
}

export function saveReports(reports: Report[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch {
    /* noop */
  }
}

export function getReportById(id: string): Report | null {
  return loadReports().find((report) => report.id === id) ?? null
}

export function filterReports(reports: Report[], filter: ReportFilter): Report[] {
  return reports.filter((report) => {
    if (filter.companyId && filter.companyId !== 'all' && report.companyId !== filter.companyId) {
      return false
    }
    if (filter.type && filter.type !== 'all' && report.type !== filter.type) return false
    if (filter.status && filter.status !== 'all' && report.status !== filter.status) return false
    if (filter.employeeId && filter.employeeId !== 'all' && report.employeeId !== filter.employeeId) {
      return false
    }
    return true
  })
}

export function searchReports(reports: Report[], query: string): Report[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return reports
  return reports.filter((report) => {
    const runtimeHaystack = report.runtimeBody
      ? [
          report.runtimeBody.briefSummary,
          report.runtimeBody.nextStep,
          report.runtimeBody.ownerDecisionRequired ?? '',
          ...report.runtimeBody.checked,
          ...report.runtimeBody.found,
          ...report.runtimeBody.recommendations,
          ...report.runtimeBody.risks.map((item) => item.message),
        ]
      : []

    const haystack = [
      report.title,
      report.summary,
      report.type,
      report.status,
      ...report.findings,
      ...report.risks,
      ...report.recommendations,
      ...runtimeHaystack,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}


function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

export function ensureSeedReports(): void {
  if (loadReports().length > 0) return

  const seeds: Report[] = [
    {
      id: 'report-arch-v1',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Platform Core Architecture Review',
      type: 'architecture',
      employeeId: 'ag-cto',
      workspaceId: null,
      summary:
        'Atlas reviewed ADR-001 platform boundaries: Employee-centric model, Assignment-based workspace access, Tool Registry mediation.',
      findings: [
        'Employee never owns Workspace — Assignment is the only linkage.',
        'Tool Registry is mandatory gateway for all external capabilities.',
        'Memory belongs to Employee identity, not LLM provider.',
      ],
      risks: [
        'Runtime integration may bypass audit if not wired through Registry.',
        'Cross-workspace memory leakage if Workspace scope not enforced.',
      ],
      recommendations: [
        'Wire all future tool invokes to audit event emission.',
        'Keep Reports append-only until Owner review workflow exists.',
      ],
      evidence: [
        {
          id: 'ev-adr-001',
          label: 'ADR-001',
          kind: 'link',
          value: 'docs/architecture/adr-001-ai-company-platform.md',
        },
        {
          id: 'ev-adr-002',
          label: 'ADR-002 Tool Registry',
          kind: 'link',
          value: 'docs/architecture/adr-002-tool-registry.md',
        },
      ],
      status: 'reviewed',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
    {
      id: 'report-qa-build',
      companyId: DEFAULT_COMPANY_ID,
      title: 'V1 Build Verification — ai-company',
      type: 'qa',
      employeeId: 'ag-qa',
      workspaceId: null,
      summary: 'Sentinel verified local build pipeline: tsc + vite build green across mission-control modules.',
      findings: [
        'All V1 pages compile without backend dependency.',
        'i18n EN/RU parity enforced via Messages type.',
      ],
      risks: ['No E2E tests yet — manual QA only in V1.'],
      recommendations: [
        'Add Playwright smoke tests before Runtime phase.',
        'Generate QA report automatically after each employee Run.',
      ],
      evidence: [
        {
          id: 'ev-build',
          label: 'Build command',
          kind: 'metric',
          value: 'npm run build — exit 0',
        },
      ],
      status: 'published',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'report-devops-local',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Local Dev Environment Health',
      type: 'devops',
      employeeId: 'ag-devops',
      workspaceId: null,
      summary: 'DevOps agent assessed local mock environment — no production deploy paths in V1 scope.',
      findings: [
        'localStorage persistence works for workspaces, memory, discussions.',
        'No real Docker/Ollama connections — architecture only.',
      ],
      risks: ['Owner may confuse mock connectionStatus with real probes.'],
      recommendations: [
        'Label all V1 UI with local-only badges.',
        'Future: health probes write devops reports automatically.',
      ],
      evidence: [
        {
          id: 'ev-env',
          label: 'Environment',
          kind: 'quote',
          value: 'mock · localhost — no runtime connected',
        },
      ],
      status: 'published',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'report-ops-workspace',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Workspace Assignment Audit Summary',
      type: 'operations',
      employeeId: null,
      workspaceId: null,
      summary:
        'Operations review of Assignment model — employees linked to workspaces without ownership transfer.',
      findings: [
        'Multiple assignments per employee supported.',
        'Load percent tracked per assignment for capacity planning.',
      ],
      risks: ['Total load > 100% across workspaces not yet flagged.'],
      recommendations: [
        'Add capacity conflict warnings in Assignment UI.',
        'Emit audit event on every assignment create/update/remove.',
      ],
      evidence: [],
      status: 'draft',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
    },
    {
      id: 'report-system-foundation',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Reports & Audit Foundation V1',
      type: 'system',
      employeeId: null,
      workspaceId: null,
      summary:
        'System report documenting the Reports-first and Audit-everything principles before Runtime.',
      findings: [
        'Reports explain what happened and why.',
        'Audit events provide immutable action trail.',
      ],
      risks: ['Without Runtime, events are seed/mock only in V1.'],
      recommendations: [
        'Every future Run must produce a report.',
        'Every tool call must append an audit event.',
      ],
      evidence: [
        {
          id: 'ev-principle',
          label: 'Reports-first principle',
          kind: 'quote',
          value: 'Every important employee action should be able to create a report.',
        },
      ],
      status: 'published',
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
  ]

  saveReports(seeds)
}

export type { Report, ReportEvidence, ReportFilter } from './report'
export type { ReportType, ReportStatus } from './reportTypes'
export { REPORT_TYPES, REPORT_STATUSES, REPORT_TYPE_META } from './reportTypes'
