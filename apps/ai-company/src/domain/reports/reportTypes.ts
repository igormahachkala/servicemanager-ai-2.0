export const REPORT_TYPES = [
  'architecture',
  'task',
  'qa',
  'devops',
  'marketing',
  'finance',
  'operations',
  'system',
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_STATUSES = ['draft', 'published', 'reviewed', 'archived'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_TYPE_META: Record<ReportType, { icon: string; order: number }> = {
  architecture: { icon: '⬡', order: 1 },
  task: { icon: '▤', order: 2 },
  qa: { icon: '✓', order: 3 },
  devops: { icon: '⛭', order: 4 },
  marketing: { icon: '📣', order: 5 },
  finance: { icon: '💰', order: 6 },
  operations: { icon: '⚙', order: 7 },
  system: { icon: '◫', order: 8 },
}
