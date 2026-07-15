/**
 * MAX mobile chat responder — intent detection + Ollama Q&A with conversation memory (111A).
 * Does not invoke Runtime orchestrator or Worker Loop.
 */

import {
  buildEmployeeConversationContext,
  formatEmployeeConversationContextForPrompt,
} from '../../domain/conversationMemory'
import { getEmployee } from '../../domain/employeeRegistry'
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
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportConstants'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  buildMobileChatDelegationProposal,
  evaluateChatDelegationPlan,
  shouldEvaluateChatDelegation,
  shouldShowDelegationProposal,
  type MobileChatDelegationCopy,
} from './mobileChatDelegation'
import type {
  MobileEmployeeChatMessageKind,
  MobileEmployeeChatTaskProposal,
  MobileEmployeeChatDelegationProposal,
} from './mobileEmployeeChat'

function buildChatSystemPrompt(employeeId: string): string {
  const registry = getEmployee(employeeId)
  const employee = resolveEmployee(employeeId)
  const codename = registry?.displayName ?? employee?.codename ?? employeeId
  const role = registry?.role.title ?? employee?.role ?? 'digital employee at AI Company'

  return [
    `You are ${codename}, ${role}.`,
    'Reply concisely in the same language as the user (Russian or English).',
    'Help the Owner with product work, implementation planning, and their work queue.',
    'Use the conversation history and working memory below — refer to prior topics when relevant.',
    'Do not claim you already executed tasks or changed code.',
    'For actionable work, say the Owner can confirm a task proposal in chat.',
  ].join(' ')
}

type OllamaGenerateResponse = {
  response?: string
  error?: string
}

export type MobileMaxChatResponderResult = {
  ownerKind: Extract<MobileEmployeeChatMessageKind, 'question' | 'task_request'>
  maxKind: Extract<
    MobileEmployeeChatMessageKind,
    'clarification' | 'task_proposal' | 'delegation_proposal' | 'report_link'
  >
  content: string
  taskProposal?: MobileEmployeeChatTaskProposal | null
  delegationProposal?: MobileEmployeeChatDelegationProposal | null
  reportId?: string | null
  runtimeRunId?: string | null
  workerLoopId?: string | null
  usedOllama: boolean
  errorMessage?: string | null
}

function findLatestMaxReportId(employeeId: string): string | null {
  const journal = loadEmployeeDailyJournalEntries()
    .filter((entry) => entry.employeeId === employeeId)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0]

  const reportRef = journal?.reportLinks?.[0]
  if (reportRef?.reportId) return reportRef.reportId
  return null
}

function findActiveMaxRuntimeRefs(employeeId: string): {
  runtimeRunId: string | null
  workerLoopId: string | null
} {
  const active = loadMaxWorkerLoopRecords().find(
    (loop) =>
      loop.employeeId === employeeId &&
      (loop.status === 'running' ||
        loop.status === 'queued' ||
        loop.status === 'waiting_approval'),
  )
  return {
    runtimeRunId: active?.runtimeRunId ?? null,
    workerLoopId: active?.id ?? null,
  }
}

async function generateOllamaChatReply(
  employeeId: string,
  userMessage: string,
): Promise<string> {
  const settings = loadOllamaSettings()
  const baseUrl = getEffectiveOllamaBaseUrl(settings)
  const modelTag = settings.defaultModelTag?.trim() || resolveOllamaModelTag('model-qwen-coder')
  const context = buildEmployeeConversationContext(employeeId)
  const contextBlock = formatEmployeeConversationContextForPrompt(context, userMessage)
  const prompt = trimPromptForFastTest(
    `${buildChatSystemPrompt(employeeId)}\n\n${contextBlock}`,
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
  employeeId?: string
  text: string
  sourceMessageId: string | null
  taskProposalIntro: string
  delegationProposalIntro: string
  delegationCopy: MobileChatDelegationCopy
  reportLinkIntro: (title: string) => string
  questionFallback: string
}): Promise<MobileMaxChatResponderResult> {
  const employeeId = input.employeeId ?? MAX_WORKER_EMPLOYEE_ID
  const trimmed = input.text.trim()
  const runtimeRefs = findActiveMaxRuntimeRefs(employeeId)
  const intent = await detectMobileChatIntent(trimmed)
  const ownerKind: 'question' | 'task_request' = shouldProposeTaskFromIntent(intent.kind)
    ? 'task_request'
    : 'question'

  if (shouldProposeTaskFromIntent(intent.kind)) {
    const built = buildMobileChatTaskProposal(trimmed, intent)
    const proposal = toChatTaskProposal(built, input.sourceMessageId)

    if (shouldEvaluateChatDelegation(employeeId, intent)) {
      const plan = evaluateChatDelegationPlan({ employeeId, taskProposal: proposal })
      if (shouldShowDelegationProposal(plan)) {
        const delegationProposal = buildMobileChatDelegationProposal({
          plan,
          taskProposal: proposal,
          copy: input.delegationCopy,
        })
        return {
          ownerKind,
          maxKind: 'delegation_proposal',
          content: `${input.delegationProposalIntro}\n\n«${delegationProposal.taskProposal.title}» → ${delegationProposal.recommendedDisplayName}`,
          taskProposal: null,
          delegationProposal,
          reportId: null,
          runtimeRunId: runtimeRefs.runtimeRunId,
          workerLoopId: runtimeRefs.workerLoopId,
          usedOllama: intent.source === 'ollama',
        }
      }
    }

    return {
      ownerKind,
      maxKind: 'task_proposal',
      content: `${input.taskProposalIntro}\n\n«${proposal.title}»`,
      taskProposal: proposal,
      delegationProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: intent.source === 'ollama',
    }
  }

  if (
    intent.kind === 'report_request' ||
    (intent.kind === 'simple_question' && /report|отчёт|отчет/i.test(trimmed))
  ) {
    const morningReportId = MOBILE_MORNING_REPORT_ID
    const latestReportId = findLatestMaxReportId(employeeId)
    const reportId = latestReportId ?? morningReportId
    const employeeLabel = getEmployee(employeeId)?.displayName ?? employeeId
    const reportTitle =
      reportId === morningReportId ? 'Утренний отчёт' : `Последний отчёт ${employeeLabel}`
    return {
      ownerKind,
      maxKind: 'report_link',
      content: input.reportLinkIntro(reportTitle),
      taskProposal: null,
      delegationProposal: null,
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
      delegationProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: false,
    }
  }

  try {
    const answer = await generateOllamaChatReply(employeeId, trimmed)
    return {
      ownerKind,
      maxKind: 'clarification',
      content: answer,
      taskProposal: null,
      delegationProposal: null,
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
      delegationProposal: null,
      reportId: null,
      runtimeRunId: runtimeRefs.runtimeRunId,
      workerLoopId: runtimeRefs.workerLoopId,
      usedOllama: false,
      errorMessage: formatRuntimeError(error),
    }
  }
}
