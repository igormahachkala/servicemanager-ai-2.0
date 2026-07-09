/**
 * Mobile Task History — task type groups (AI-COMPANY-109B).
 */

import type { WorkStatus } from '../../domain/employeeWorkQueue'
import type { ReportType } from '../../domain/reports/reportTypes'
import { MOBILE_TASK_TEMPLATES, type MobileTaskTemplateId } from '../runTask/mobileRunTaskConfig'

export const MOBILE_TASK_HISTORY_GROUP_IDS = [
  'checks',
  'audits',
  'development',
  'errors_runtime',
  'reports',
  'planning',
  'other',
] as const

export type MobileTaskHistoryGroupId = (typeof MOBILE_TASK_HISTORY_GROUP_IDS)[number]

export type MobileTaskHistoryClassifyInput = {
  title: string
  taskText?: string | null
  summary?: string | null
  reportType?: ReportType | null
  workStatus?: WorkStatus | null
}

const TEMPLATE_GROUP: Record<MobileTaskTemplateId, MobileTaskHistoryGroupId> = {
  standard_health_check: 'checks',
  review_ui: 'checks',
  review_architecture: 'audits',
  find_bugs: 'errors_runtime',
  cursor_handoff: 'development',
  prepare_report: 'reports',
}

function combinedText(input: MobileTaskHistoryClassifyInput): string {
  return [input.title, input.taskText, input.summary].filter(Boolean).join(' ').toLowerCase()
}

function matchTemplateGroup(input: MobileTaskHistoryClassifyInput): MobileTaskHistoryGroupId | null {
  const title = input.title.trim().toLowerCase()
  const taskText = input.taskText?.trim().toLowerCase() ?? ''
  for (const template of MOBILE_TASK_TEMPLATES) {
    if (
      title === template.title.toLowerCase() ||
      (template.label && title === template.label.toLowerCase()) ||
      (taskText.length > 20 && taskText === template.taskText.trim().toLowerCase())
    ) {
      return TEMPLATE_GROUP[template.id]
    }
  }
  return null
}

export function classifyMobileTaskHistoryGroup(
  input: MobileTaskHistoryClassifyInput,
): MobileTaskHistoryGroupId {
  const templateGroup = matchTemplateGroup(input)
  if (templateGroup) return templateGroup

  if (
    input.workStatus === 'skipped' ||
    input.workStatus === 'cancelled' ||
    input.workStatus === 'blocked'
  ) {
    return 'errors_runtime'
  }

  const text = combinedText(input)

  if (/ошибк|error|bug|fail|сбой|blocked|runtime run|worker loop failed/.test(text)) {
    return 'errors_runtime'
  }
  if (/отчёт|отчет|report|morning report|journal|prepare_report|итог дня|summary/.test(text)) {
    return 'reports'
  }
  if (input.reportType === 'task' || input.reportType === 'operations') {
    return 'reports'
  }
  if (/план|planning|roadmap|sprint|schedule|планир|backlog|agenda/.test(text)) {
    return 'planning'
  }
  if (/аудит|audit|architecture|архитект|security review|compliance/.test(text)) {
    return 'audits'
  }
  if (input.reportType === 'architecture' || input.reportType === 'qa') {
    return 'audits'
  }
  if (/разработ|develop|cursor|handoff|codex|implement|refactor|feature|код|coding|fix/.test(text)) {
    return 'development'
  }
  if (/провер|check|health|review_ui|status|smoke|validate|стандартн|inspect|диагност/.test(text)) {
    return 'checks'
  }
  if (input.reportType === 'system') {
    return 'checks'
  }

  return 'other'
}

export function isMobileTaskHistoryGroupId(value: string): value is MobileTaskHistoryGroupId {
  return (MOBILE_TASK_HISTORY_GROUP_IDS as readonly string[]).includes(value)
}
