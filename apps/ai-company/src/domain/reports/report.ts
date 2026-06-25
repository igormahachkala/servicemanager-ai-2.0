import type { ReportStatus, ReportType } from './reportTypes'

export type ReportEvidence = {
  id: string
  label: string
  kind: 'link' | 'artifact' | 'quote' | 'metric'
  value: string
}

export type Report = {
  id: string
  title: string
  type: ReportType
  employeeId: string | null
  workspaceId: string | null
  summary: string
  findings: string[]
  risks: string[]
  recommendations: string[]
  evidence: ReportEvidence[]
  status: ReportStatus
  createdAt: string
  updatedAt: string
}

export type ReportFilter = {
  type?: ReportType | 'all'
  status?: ReportStatus | 'all'
  employeeId?: string | 'all'
}
