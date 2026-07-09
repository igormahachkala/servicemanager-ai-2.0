import type { WorkPriority } from '../employeeWorkQueue'
import { WORK_ITEM_STRUCTURED_PAYLOAD_VERSION } from '../employeeWorkQueue/workItemStructuredPayload'
import type { WorkItemStructuredPayload } from '../employeeWorkQueue/workItemStructuredPayload'
import type { MobileChatIntentKind, MobileChatIntentResult, MobileChatTaskProposal } from './mobileChatIntentTypes'

function deriveTitle(message: string): string {
  const line = message.trim().split('\n')[0]?.trim() ?? 'Задача из чата'
  if (line.length <= 100) return line
  return `${line.slice(0, 97)}…`
}

function inferPriority(message: string): WorkPriority {
  const lower = message.toLowerCase()
  if (/(?:срочно|critical|asap|немедленно)/.test(lower)) return 'critical'
  if (/(?:важно|high|высок(?:ий|ая) приоритет)/.test(lower)) return 'high'
  if (/(?:низк(?:ий|ая)|low|когда будет время)/.test(lower)) return 'low'
  return 'medium'
}

function inferExpectedResult(intent: MobileChatIntentKind): string {
  switch (intent) {
    case 'report_request':
      return 'Structured report for Owner: summary, findings, risks, next actions.'
    case 'cursor_handoff_request':
      return 'Handoff brief for Cursor: goal, steps, files, acceptance criteria.'
    case 'complex_task_request':
      return 'Structured report with findings, risks, and recommended next steps.'
    default:
      return 'Краткий отчёт и рекомендуемый следующий шаг для Owner.'
  }
}

function templateMeta(intent: MobileChatIntentKind): {
  title: string | null
  taskPrefix: string | null
  templateId: string | null
  priority: WorkPriority | null
  expectedOutput: string | null
} {
  if (intent === 'cursor_handoff_request') {
    return {
      title: 'Cursor handoff',
      taskPrefix:
        'Подготовь handoff для Cursor: цель, шаги, файлы, критерии готовности, риски.',
      templateId: 'cursor_handoff',
      priority: 'medium',
      expectedOutput:
        'Handoff-ready brief для Cursor: цель, шаги, файлы, критерии готовности, риски.',
    }
  }
  if (intent === 'report_request') {
    return {
      title: 'Сформировать отчёт',
      taskPrefix:
        'Сформировать отчёт для Owner по выполненной работе: что сделано, риски, блокеры, что требует решения Owner.',
      templateId: 'prepare_report',
      priority: 'medium',
      expectedOutput:
        'Structured report: summary, findings, decisions needed, recommended next actions.',
    }
  }
  return {
    title: null,
    taskPrefix: null,
    templateId: null,
    priority: null,
    expectedOutput: null,
  }
}

function buildComplexPayload(
  message: string,
  intent: MobileChatIntentKind,
  expectedResult: string,
  templateId: string | null,
): WorkItemStructuredPayload {
  return {
    version: WORK_ITEM_STRUCTURED_PAYLOAD_VERSION,
    mode: 'complex',
    templateId,
    objective: message.trim(),
    context: 'Задача сформулирована Owner в mobile chat с MAX.',
    expectedResult,
    constraints: 'Только локальный код; без изменений Runtime/Worker Loop без отдельной задачи.',
    forbidden: 'Не запускать Worker Loop без явного подтверждения Owner.',
    deadline: intent === 'report_request' ? 'Сегодня' : null,
    needsReport: true,
    needsNextSteps: true,
  }
}

function buildQuickPayload(expectedResult: string, templateId: string | null): WorkItemStructuredPayload {
  return {
    version: WORK_ITEM_STRUCTURED_PAYLOAD_VERSION,
    mode: 'quick',
    templateId,
    expectedResult,
  }
}

export function buildMobileChatTaskProposal(
  message: string,
  intentResult: MobileChatIntentResult,
): MobileChatTaskProposal {
  const meta = templateMeta(intentResult.kind)
  const expectedResult = meta.expectedOutput ?? inferExpectedResult(intentResult.kind)
  const priority = meta.priority ?? inferPriority(message)
  const title = meta.title ?? deriveTitle(message)
  const taskText = meta.taskPrefix
    ? `${meta.taskPrefix}\n\n## Сообщение Owner\n${message.trim()}`
    : message.trim()

  const isComplex =
    intentResult.kind === 'complex_task_request' ||
    intentResult.kind === 'cursor_handoff_request' ||
    message.trim().length >= 120

  const structuredPayload = isComplex
    ? buildComplexPayload(message, intentResult.kind, expectedResult, meta.templateId)
    : buildQuickPayload(expectedResult, meta.templateId)

  return {
    title,
    taskText,
    priority,
    expectedResult,
    structuredPayload,
    sourceMessage: message.trim(),
    intent: intentResult.kind,
  }
}
