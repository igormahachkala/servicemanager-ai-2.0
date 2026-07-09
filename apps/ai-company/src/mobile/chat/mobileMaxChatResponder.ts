/**
 * MAX mobile chat responder — intent detection + optional Ollama Q&A (110B).
 * Does not invoke Runtime orchestrator or Worker Loop.
 */

import { loadEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import {
  buildMobileChatTaskProposal,
  detectMobileChatIntent,
  detectMobileChatIntentHeuristic,
  shouldProposeTaskFromIntent,
} from '../../domain/mobileChatIntent'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop/maxWorkerLoopStorage'
import {
  fetchWithRetry,
  formatRuntimeError,
  getEffectiveOllamaBaseUrl,
  loadOllamaSettings,
} from '../../domain/runtime/providers/runtimeHealth'
import {
  getOllamaGenerateOptions,
  resolveOllamaModelTag,
  trimPromptForFastTest,
} from '../../domain/runtime/providers/runtimeCapabilities'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportsSnapshot'
import type {
  MobileEmployeeChatMessageKind,
  MobileEmployeeChatTaskProposal,
} from './mobileEmployeeChat'

const MAX_CHAT_SYSTEM_PROMPT = [
  'You are MAX, senior engineer at AI Company.',
  'Reply concisely in the same language as the user (Russian or English).',
  'Help the Owner with product, architecture, mobile UX, and MAX work queue.',
  'Do not claim you already executed tasks or changed code.',
  'For actionable work, say the Owner can confirm a task proposal in chat.',
].join(' ')

type OllamaGenerateResponse = {
  response?: string
  error?: string
}

export type MobileMaxChatResponderResult = {
  ownerKind: Extract<MobileEmployeeChatMessageKind, 'question' | 'task_request'>
  maxKind: Extract<MobileEmployeeChatMessageKind, 'clarification' | 'task_proposal' | 'report_link'>
  content: string
  taskProposal?: MobileEmployeeChatTaskProposal | null
  reportId?: string | null
  runtimeRunId?: string | null
  workerLoopId?: string | null
  usedOllama: boolean
  errorMessage?: string | null
}

function findLatestMaxReportId(): string | null {
  const journal = loadEmployeeDailyJournalEntries()
    .filter((entry) => entry.employeeId === MAX_WORKER_EMPLOYEE_ID)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0]

  const reportRef = journal?.reportLinks?.[0]
  if (reportRef?.reportId) return reportRef.reportId
  return null
}

function findActiveMaxRuntimeRefs(): { runtimeRunId: string | null; workerLoopId: string | null } {
  const active = loadMaxWorkerLoopRecords().find(
    (loop) =>
      loop.status === 'running' ||
      loop.status === 'queued' ||
      loop.status === 'waiting_approval',
  )
  return {
    runtimeRunId: active?.runtimeRunId ?? null,
    workerLoopId: active?.id ?? null,
  }
}

async function generateOllamaChatReply(userMessage: string): Promise<string> {
  const settings = loadOllamaSettings()
  const baseUrl = getEffectiveOllamaBaseUrl(settings)
  const modelTag = settings.defaultModelTag?.trim() || resolveOllamaModelTag('model-qwen-coder')
  const prompt = trimPromptForFastTest(
    `${MAX_CHAT_SYSTEM_PROMPT}\n\nOwner: ${userMessage.trim()}\n\nMAX:`,
    modelTag,
  )

  const response = await fetchWithRetry(
    `${baseUrl}/api/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: modelTag,
        prompt,
        stream: false,
        options: getOllamaGenerateOptions(modelTag),
      }),
    },
    { retries: 1, retryDelayMs: 400 },
  )

  if (!response.ok) {
    throw new Error(`Ollama /api/generate failed with HTTP ${response.status}`)
  }

  const payload = (await response.json()) as OllamaGenerateResponse
  if (payload.error?.trim()) {
    throw new Error(payload.error.trim())
  }

  const answer = payload.response?.trim()
  if (!answer) {
    throw new Error('Ollama returned an empty response')
  }

  return answer
}

function toChatTaskProposal(
  proposal: ReturnType<typeof buildMobileChatTaskProposal>,
  sourceMessageId: string | null,
): MobileEmployeeChatTaskProposal {
  return {
    title: proposal.title,
    taskText: proposal.taskText,
    priority: proposal.priority,
    expectedResult: proposal.expectedResult,
    structuredPayload: proposal.structuredPayload,
    sourceMessageId,
  }
}

export function classifyOwnerChatMessage(text: string): 'question' | 'task_request' {
  const intent = detectMobileChatIntentHeuristic(text)
  return shouldProposeTaskFromIntent(intent.kind) ? 'task_request' : 'question'
}

export async function respondToOwnerChatMessage(input: {
  text: string
  sourceMessageId: string | null
  taskProposalIntro: string
  reportLinkIntro: (title: string) => string
  questionFallback: string
}): Promise<MobileMaxChatResponderResult> {
  const trimmed = input.text.trim()
  const runtimeRefs = findActiveMaxRuntimeRefs()
  const intent = await detectMobileChatIntent(trimmed)
  const ownerKind: 'question' | 'task_request' = shouldProposeTaskFromIntent(intent.kind)
    ? 'task_request'
    : 'question'

  if (shouldProposeTaskFromIntent(intent.kind)) {
    const built = buildMobileChatTaskProposal(trimmed, intent)
    const proposal = toChatTaskProposal(built, input.sourceMessageId)
    return {
      ownerKind,
      maxKind: 'task_proposal',
      content: `${input.taskProposalIntro}\n\n«${proposal.title}»`,
      taskProposal: proposal,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: intent.source === 'ollama',
    }
  }

  if (intent.kind === 'report_request' || intent.kind === 'simple_question' && /report|отчёт|отчет/i.test(trimmed)) {
    const morningReportId = MOBILE_MORNING_REPORT_ID
    const latestReportId = findLatestMaxReportId()
    const reportId = latestReportId ?? morningReportId
    return {
      ownerKind,
      maxKind: 'report_link',
      content: input.reportLinkIntro(reportId === morningReportId ? 'Утренний отчёт' : 'Последний отчёт MAX'),
      taskProposal: null,
      reportId,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: false,
    }
  }

  if (intent.kind === 'casual_question' || intent.kind === 'unclear') {
    return {
      ownerKind,
      maxKind: 'clarification',
      content: input.questionFallback,
      taskProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: false,
    }
  }

  try {
    const answer = await generateOllamaChatReply(trimmed)
    return {
      ownerKind,
      maxKind: 'clarification',
      content: answer,
      taskProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: true,
    }
  } catch (error) {
    return {
      ownerKind,
      maxKind: 'clarification',
      content: input.questionFallback,
      taskProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: false,
      errorMessage: formatRuntimeError(error),
    }
  }
}
