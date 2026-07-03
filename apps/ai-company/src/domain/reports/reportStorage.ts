import { DEFAULT_COMPANY_ID } from '../company/company'
import {
  shouldSeedReports,
  syncRuntimeDerivedStores,
} from '../runtime/runtimeDataSources'
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
  syncRuntimeDerivedStores()
  if (!shouldSeedReports()) return

  const seeds: Report[] = [
    {
      id: 'report-arch-v1',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Обзор архитектуры платформы',
      type: 'architecture',
      employeeId: 'ag-cto',
      workspaceId: null,
      summary:
        'Atlas проверил границы ADR-001: модель Employee-centric, доступ к workspace через Assignment, медиация через Tool Registry.',
      findings: [
        'Employee не владеет Workspace — связь только через Assignment.',
        'Tool Registry обязателен для всех внешних capabilities.',
        'Память принадлежит идентичности Employee, а не LLM-провайдеру.',
      ],
      risks: [
        '[High] Интеграция Runtime может обойти audit без Registry.',
        '[Medium] Утечка памяти между workspace при слабом scope.',
      ],
      recommendations: [
        'Подключить все tool invoke к emission audit events.',
        'Держать отчёты append-only до полного Owner review workflow.',
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
      title: 'Проверка сборки V1 — ai-company',
      type: 'qa',
      employeeId: 'ag-qa',
      workspaceId: null,
      summary: 'Sentinel проверил локальный pipeline: tsc + vite build проходят по модулям mission-control.',
      findings: [
        'Все страницы V1 компилируются без backend.',
        'Паритет i18n EN/RU обеспечен типом Messages.',
      ],
      risks: ['[Medium] E2E-тестов пока нет — только ручной QA в V1.'],
      recommendations: [
        'Добавить Playwright smoke до фазы Runtime.',
        'Генерировать QA-отчёт автоматически после каждого Run сотрудника.',
      ],
      evidence: [
        {
          id: 'ev-build',
          label: 'Команда сборки',
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
      title: 'Состояние локального dev-окружения',
      type: 'devops',
      employeeId: 'ag-devops',
      workspaceId: null,
      summary: 'DevOps-агент оценил локальное mock-окружение — production deploy в scope V1 отсутствует.',
      findings: [
        'localStorage корректно хранит workspaces, memory, discussions.',
        'Реальных Docker/Ollama подключений нет — только архитектура.',
      ],
      risks: ['[Low] Owner может принять mock connectionStatus за реальные probes.'],
      recommendations: [
        'Пометить весь UI V1 бейджами «только локально».',
        'Далее: health probes автоматически пишут devops-отчёты.',
      ],
      evidence: [
        {
          id: 'ev-env',
          label: 'Окружение',
          kind: 'quote',
          value: 'mock · localhost — runtime не подключён',
        },
      ],
      status: 'published',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'report-ops-workspace',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Аудит назначений workspace',
      type: 'operations',
      employeeId: null,
      workspaceId: null,
      summary:
        'Операционный review модели Assignment — сотрудники связаны с workspace без передачи ownership.',
      findings: [
        'Поддерживается несколько assignments на одного сотрудника.',
        'Load percent отслеживается для планирования capacity.',
      ],
      risks: ['[Medium] Суммарная нагрузка >100% между workspace пока не подсвечивается.'],
      recommendations: [
        'Добавить предупреждения о конфликте capacity в UI Assignment.',
        'Писать audit event при каждом create/update/remove assignment.',
      ],
      evidence: [],
      status: 'draft',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
    },
    {
      id: 'report-system-foundation',
      companyId: DEFAULT_COMPANY_ID,
      title: 'Основа отчётов и аудита V1',
      type: 'system',
      employeeId: null,
      workspaceId: null,
      summary:
        'Системный отчёт о принципах «сначала отчёт» и «всё в audit» до подключения Runtime.',
      findings: [
        'Отчёты объясняют, что произошло и почему.',
        'Audit events дают неизменяемый след действий.',
      ],
      risks: ['[Low] Без Runtime события в V1 только seed/mock.'],
      recommendations: [
        'Каждый будущий Run должен создавать отчёт.',
        'Каждый tool call должен дописывать audit event.',
      ],
      evidence: [
        {
          id: 'ev-principle',
          label: 'Принцип «сначала отчёт»',
          kind: 'quote',
          value: 'Каждое важное действие сотрудника должно уметь создать отчёт.',
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
