import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT } from '../../domain/cursorHandoffFromChat/cursorHandoffFromChatStorage'
import {
  buildEmployeeConversationContext,
  getConversationMemoryStats,
  recordConversationExchange,
} from '../../domain/conversationMemory'
import { tryProcessMobileCursorHandoffFromOwnerMessage } from '../../domain/cursorHandoffFromChat'
import {
  hasMobileEmployeeCapability,
  mobileEmployeeTasksNewPath,
} from '../../domain/mobileEmployee'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop/maxWorkerLoopStorage'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { useI18n } from '../../i18n'
import { resolveMobileEmployeeChatCopy } from '../mobileEmployeeCopy'
import type { MobileEmployeeChatMessage } from '../chat/mobileEmployeeChat'
import { MOBILE_EMPLOYEE_CHAT_SYNC_EVENT } from '../chat/mobileEmployeeChat'
import { DELEGATION_PLAN_SYNC_EVENT } from '../../domain/delegationPlan'
import {
  acceptDelegationReview,
  DELEGATION_REVIEW_SYNC_EVENT,
  requestDelegationReviewRework,
} from '../../domain/delegationReview'
import {
  approveDelegationPlan,
  cancelDelegationPlan,
} from '../../domain/delegationPlan/delegationPlanStorage'
import { executeApprovedDelegationPlan } from '../../domain/delegationExecution'
import { createWorkItemFromChatProposal } from '../chat/mobileChatTaskBridge'
import { stashMobileChatTaskPrefill } from '../chat/mobileChatTaskPrefill'
import {
  buildMobileChatTimeline,
  filterMobileChatTimelineEntries,
  MOBILE_CHAT_TIMELINE_FILTERS,
  type MobileChatTimelineFilterId,
  type MobileChatTimelineLabels,
} from '../chat/mobileChatTimeline'
import type { MobileChatDelegationCopy } from '../chat/mobileChatDelegation'
import {
  appendMobileEmployeeChatMessage,
  getMobileEmployeeChatSession,
  updateMobileEmployeeChatMessage,
} from '../chat/mobileEmployeeChatStorage'
import {
  classifyOwnerChatMessage,
  respondToOwnerChatMessage,
} from '../chat/mobileMaxChatResponder'
import {
  applyAssigneeToDelegationProposal,
  persistChatDelegationPlan,
  updateDelegationPlanAssignee,
} from '../chat/mobileChatDelegation'
import { useMobileRunNextSheet } from './useMobileRunNextSheet'
import { useMobileChatDelegationEmployeeSheet } from './useMobileChatDelegationEmployeeSheet'

export type MobileEmployeeChatStatus = {
  label: string
  detail: string | null
  tone: 'default' | 'live' | 'waiting' | 'offline'
}

/** @deprecated use MobileEmployeeChatStatus */
export type MobileMaxChatStatus = MobileEmployeeChatStatus

function formatTimestamp(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const APPROVAL_SYNC_EVENT = 'ai-company-approval-sync'

function recordChatMemory(employeeId: string): void {
  if (!hasMobileEmployeeCapability(employeeId, 'conversation_memory')) return
  const session = getMobileEmployeeChatSession(employeeId)
  recordConversationExchange({ employeeId, messages: session.messages })
}

function resolveMaxDelegationCopy(
  copy: ReturnType<typeof resolveMobileEmployeeChatCopy>,
): typeof import('../../i18n/mobile/ru').mobileRu.maxChat.delegation | null {
  if (!('delegation' in copy) || typeof copy.delegation !== 'object') return null
  return copy.delegation as typeof import('../../i18n/mobile/ru').mobileRu.maxChat.delegation
}

function buildTimelineLabels(copy: typeof import('../../i18n/mobile/ru').mobileRu.maxChat.timeline): MobileChatTimelineLabels {
  return {
    events: copy.events,
    taskCreatedBody: copy.bodies.taskCreated,
    taskStartedBody: copy.bodies.taskStarted,
    runtimeStartedBody: copy.bodies.runtimeStarted,
    runtimeCompletedBody: copy.bodies.runtimeCompleted,
    runtimeFailedBody: copy.bodies.runtimeFailed,
    reportReadyBody: copy.bodies.reportReady,
    cursorHandoffCreatedBody: copy.bodies.cursorHandoffCreated,
    cursorHandoffSentBody: copy.bodies.cursorHandoffSent,
    cursorResultReceivedBody: copy.bodies.cursorResultReceived,
    ownerApprovalApprovedBody: copy.bodies.ownerApprovalApproved,
    ownerApprovalRejectedBody: copy.bodies.ownerApprovalRejected,
    ownerApprovalPendingBody: copy.bodies.ownerApprovalPending,
    delegationProposedBody: copy.bodies.delegationProposed,
    delegationApprovedBody: copy.bodies.delegationApproved,
    delegationRejectedBody: copy.bodies.delegationRejected,
    delegationExecutedBody: copy.bodies.delegationExecuted,
    toolRequestedBody: copy.bodies.toolRequested,
    toolApprovedBody: copy.bodies.toolApproved,
    toolRejectedBody: copy.bodies.toolRejected,
    taskAssignedBody: copy.bodies.taskAssigned,
  }
}

function resolveChatDelegationCopy(
  copy: ReturnType<typeof resolveMobileEmployeeChatCopy>,
): MobileChatDelegationCopy {
  if ('delegation' in copy && copy.delegation && typeof copy.delegation === 'object') {
    const delegation = copy.delegation as MobileChatDelegationCopy
    return {
      intro: delegation.intro ?? copy.taskProposalIntro,
      afterConfirm: delegation.afterConfirm ?? copy.taskCreated.replace('{title}', ''),
    }
  }
  return {
    intro: copy.taskProposalIntro,
    afterConfirm: copy.taskCreated.replace('{title}', ''),
  }
}

function resolveDelegationProposalIntro(
  copy: ReturnType<typeof resolveMobileEmployeeChatCopy>,
): string {
  if ('delegationProposalIntro' in copy && typeof copy.delegationProposalIntro === 'string') {
    return copy.delegationProposalIntro
  }
  return copy.taskProposalIntro
}

export function useMobileEmployeeChat(employeeId: string) {
  const canonical = employeeId
  const { t } = useI18n()
  const copy = resolveMobileEmployeeChatCopy(canonical, t.mobile)
  const navigate = useNavigate()
  const { openRunNextFlow } = useMobileRunNextSheet()
  const { openAssigneePicker } = useMobileChatDelegationEmployeeSheet()
  const maxDelegationCopy = resolveMaxDelegationCopy(copy)
  const canUseCursorHandoff = hasMobileEmployeeCapability(canonical, 'cursor_handoff')
  const canShowRuntimeLive = hasMobileEmployeeCapability(canonical, 'runtime_live')
  const canRunWorkerLoop = hasMobileEmployeeCapability(canonical, 'worker_loop')
  const canUseConversationMemory = hasMobileEmployeeCapability(canonical, 'conversation_memory')

  const [sessionTick, setSessionTick] = useState(0)
  const [draft, setDraft] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [timelineFilter, setTimelineFilter] = useState<MobileChatTimelineFilterId>('all')

  const refresh = useCallback(() => {
    setSessionTick((value) => value + 1)
  }, [])

  useEffect(() => {
    getMobileEmployeeChatSession(canonical, { welcome: copy.welcome })
  }, [canonical, copy.welcome])

  useEffect(() => {
    const onSync = () => refresh()
    const events = [
      MOBILE_EMPLOYEE_CHAT_SYNC_EVENT,
      CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT,
      EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
      MAX_WORKER_LOOP_SYNC_EVENT,
      EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT,
      APPROVAL_SYNC_EVENT,
      DELEGATION_PLAN_SYNC_EVENT,
      DELEGATION_REVIEW_SYNC_EVENT,
      'ai-company-builder-tool-decision-sync',
      'ai-company-builder-tool-execution-sync',
      'ai-company-runtime-sync',
    ]
    for (const eventName of events) {
      window.addEventListener(eventName, onSync)
    }
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, onSync)
      }
    }
  }, [refresh])

  void sessionTick
  const session = getMobileEmployeeChatSession(canonical, { welcome: copy.welcome })
  const messages = session.messages

  const timelineLabels = useMemo(() => {
    const base = t.mobile.maxChat.timeline
    const local = copy.timeline
    return buildTimelineLabels({
      ...base,
      events: { ...base.events, ...local.events },
      bodies: { ...base.bodies, ...local.bodies },
    })
  }, [copy.timeline, t.mobile.maxChat.timeline])

  const timelineEntries = useMemo(
    () =>
      filterMobileChatTimelineEntries(
        buildMobileChatTimeline({
          employeeId: canonical,
          messages,
          labels: timelineLabels,
        }),
        timelineFilter,
      ),
    [canonical, messages, timelineFilter, timelineLabels],
  )

  const timelineFilterOptions = useMemo(
    () =>
      MOBILE_CHAT_TIMELINE_FILTERS.map((id) => ({
        id,
        label: copy.timeline.filters[id],
      })),
    [copy.timeline.filters],
  )

  const status: MobileEmployeeChatStatus = useMemo(() => {
    if (canShowRuntimeLive) {
      const activeLoop = loadMaxWorkerLoopRecords().find(
        (loop) =>
          loop.employeeId === canonical &&
          (loop.status === 'running' ||
            loop.status === 'queued' ||
            loop.status === 'waiting_approval'),
      )
      if (activeLoop) {
        return {
          label: copy.status.live,
          detail: activeLoop.input.title?.slice(0, 80) ?? null,
          tone: 'live',
        }
      }
    }
    if (isResponding) {
      return { label: copy.status.thinking, detail: null, tone: 'waiting' }
    }
    if (canUseConversationMemory && 'memoryHint' in copy.status) {
      const stats = getConversationMemoryStats(buildEmployeeConversationContext(canonical))
      return {
        label: copy.status.ready,
        detail: copy.status.memoryHint
          .replace('{count}', String(stats.messageCount))
          .replace('{window}', String(stats.windowSize)),
        tone: 'default',
      }
    }
    return { label: copy.status.ready, detail: copy.status.readyHint, tone: 'default' }
  }, [canShowRuntimeLive, canUseConversationMemory, canonical, copy.status, isResponding])

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim()
      if (!content || isResponding) return

      setActionError(null)
      setDraft('')
      setIsResponding(true)

      const ownerKind = classifyOwnerChatMessage(content)
      const ownerMessage = appendMobileEmployeeChatMessage(canonical, {
        role: 'owner',
        kind: ownerKind,
        content,
      })

      const recentOwner = messages
        .filter((item) => item.role === 'owner')
        .slice(-5)
        .map((item) => item.content)
      recentOwner.push(content)

      const handoff = canUseCursorHandoff
        ? tryProcessMobileCursorHandoffFromOwnerMessage({
            employeeId: canonical,
            ownerMessageId: ownerMessage.id,
            ownerContent: content,
            recentOwnerMessages: recentOwner,
          })
        : null

      if (handoff) {
        appendMobileEmployeeChatMessage(canonical, {
          role: 'max',
          kind: 'cursor_handoff',
          content: copy.cursorHandoff.cardTitle,
          cursorHandoffId: handoff.handoffId,
        })
        refresh()
        setIsResponding(false)
        return
      }

      const pendingId = appendMobileEmployeeChatMessage(canonical, {
        role: 'max',
        kind: 'clarification',
        content: copy.status.thinking,
        pending: true,
      }).id

      try {
        const response = await respondToOwnerChatMessage({
          employeeId: canonical,
          text: content,
          sourceMessageId: ownerMessage.id,
          taskProposalIntro: copy.taskProposalIntro,
          delegationProposalIntro: resolveDelegationProposalIntro(copy),
          delegationCopy: resolveChatDelegationCopy(copy),
          reportLinkIntro: (title) => copy.reportLinkIntro.replace('{title}', title),
          questionFallback: copy.questionFallback,
        })

        let delegationProposal = response.delegationProposal ?? null
        if (delegationProposal && !response.errorMessage) {
          delegationProposal = persistChatDelegationPlan({
            employeeId: canonical,
            delegationProposal,
          })
          if (maxDelegationCopy) {
            appendMobileEmployeeChatMessage(canonical, {
              role: 'system',
              kind: 'delegation_event',
              content: maxDelegationCopy.events.proposed.replace(
                '{employee}',
                delegationProposal.recommendedDisplayName,
              ),
            })
          }
        }

        updateMobileEmployeeChatMessage(canonical, pendingId, {
          kind: response.maxKind,
          content: response.errorMessage
            ? `${copy.errors.ollama}\n${response.errorMessage}`
            : response.content,
          pending: false,
          error: Boolean(response.errorMessage),
          taskProposal: response.taskProposal ?? null,
          delegationProposal,
          reportId: response.reportId,
          runtimeRunId: response.runtimeRunId,
          workerLoopId: response.workerLoopId,
        })

        if (!response.errorMessage) {
          recordChatMemory(canonical)
        }
      } catch (error) {
        updateMobileEmployeeChatMessage(canonical, pendingId, {
          content: copy.errors.generic,
          pending: false,
          error: true,
        })
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      } finally {
        setIsResponding(false)
        refresh()
      }
    },
    [canUseCursorHandoff, canonical, copy, isResponding, maxDelegationCopy, messages, refresh],
  )

  const createTaskFromProposal = useCallback(
    (message: MobileEmployeeChatMessage, runNow: boolean) => {
      if (!message.taskProposal || message.workItemId) return
      setActionError(null)

      try {
        const workItem = createWorkItemFromChatProposal(message.taskProposal, canonical)
        updateMobileEmployeeChatMessage(canonical, message.id, {
          workItemId: workItem.id,
          content: `${message.content}\n\n${copy.taskCreated.replace('{title}', workItem.title)}`,
        })

        appendMobileEmployeeChatMessage(canonical, {
          role: 'system',
          kind: 'system_status',
          content: copy.taskQueued.replace('{id}', workItem.id),
        })

        if (runNow && canRunWorkerLoop) {
          openRunNextFlow({ workItem, goldenPath: true })
        }
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [canRunWorkerLoop, canonical, copy, openRunNextFlow, refresh],
  )

  const editTaskProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      if (!message.taskProposal) return
      stashMobileChatTaskPrefill({
        title: message.taskProposal.title,
        taskText: message.taskProposal.taskText,
        priority: message.taskProposal.priority ?? 'medium',
        expectedResult: message.taskProposal.expectedResult ?? '',
        structuredPayload: message.taskProposal.structuredPayload ?? null,
        sourceMessage: message.taskProposal.taskText,
        intent: 'task_request',
      })
      navigate(mobileEmployeeTasksNewPath(canonical))
    },
    [canonical, navigate],
  )

  const cancelTaskProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      updateMobileEmployeeChatMessage(canonical, message.id, {
        taskProposal: null,
        kind: 'clarification',
        content: copy.proposalCancelled,
      })
      refresh()
    },
    [canonical, copy.proposalCancelled, refresh],
  )

  const approveDelegationProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const proposal = message.delegationProposal
      if (!proposal || proposal.status !== 'pending' || !maxDelegationCopy) return
      setActionError(null)

      try {
        updateDelegationPlanAssignee(proposal.delegationPlanId, proposal.selectedEmployeeId)
        const approved = approveDelegationPlan(proposal.delegationPlanId)
        if (!approved) {
          throw new Error(copy.actionFailed)
        }

        const nextProposal = { ...proposal, status: 'awaiting_execution' as const }
        updateMobileEmployeeChatMessage(canonical, message.id, {
          kind: 'delegation_event',
          delegationProposal: nextProposal,
        })

        appendMobileEmployeeChatMessage(canonical, {
          role: 'system',
          kind: 'delegation_event',
          content: maxDelegationCopy.events.approved.replace(
            '{employee}',
            proposal.recommendedDisplayName,
          ),
        })
        appendMobileEmployeeChatMessage(canonical, {
          role: 'system',
          kind: 'delegation_event',
          content: maxDelegationCopy.events.awaitingExecution.replace(
            '{employee}',
            proposal.recommendedDisplayName,
          ),
        })

        recordChatMemory(canonical)
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [canonical, copy.actionFailed, copy.errors.generic, maxDelegationCopy, refresh],
  )

  const keepDelegationWithMax = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const proposal = message.delegationProposal
      if (!proposal || proposal.status !== 'pending' || !maxDelegationCopy) return
      setActionError(null)

      try {
        cancelDelegationPlan(proposal.delegationPlanId, maxDelegationCopy.events.keepMax)
        updateMobileEmployeeChatMessage(canonical, message.id, {
          kind: 'task_proposal',
          taskProposal: proposal.taskProposal,
          delegationProposal: null,
          content: `${copy.taskProposalIntro}\n\n«${proposal.taskProposal.title}»`,
        })
        appendMobileEmployeeChatMessage(canonical, {
          role: 'system',
          kind: 'delegation_event',
          content: maxDelegationCopy.events.keepMax,
        })
        recordChatMemory(canonical)
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [
      canonical,
      copy.errors.generic,
      copy.taskProposalIntro,
      maxDelegationCopy,
      refresh,
    ],
  )

  const cancelDelegationProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const proposal = message.delegationProposal
      if (!proposal || proposal.status !== 'pending' || !maxDelegationCopy) return
      setActionError(null)

      try {
        cancelDelegationPlan(proposal.delegationPlanId, maxDelegationCopy.events.cancelled)
        updateMobileEmployeeChatMessage(canonical, message.id, {
          kind: 'delegation_event',
          delegationProposal: { ...proposal, status: 'cancelled' },
          content: `${message.content}\n\n${maxDelegationCopy.events.cancelled}`,
        })
        appendMobileEmployeeChatMessage(canonical, {
          role: 'system',
          kind: 'delegation_event',
          content: maxDelegationCopy.events.cancelled,
        })
        recordChatMemory(canonical)
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [canonical, copy.errors.generic, maxDelegationCopy, refresh],
  )

  const changeDelegationAssignee = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const proposal = message.delegationProposal
      if (!proposal || proposal.status !== 'pending' || !maxDelegationCopy) return

      openAssigneePicker({
        selectedEmployeeId: proposal.selectedEmployeeId,
        onSelect: (employeeId) => {
          const nextProposal = applyAssigneeToDelegationProposal(
            proposal,
            employeeId,
            resolveChatDelegationCopy(copy),
          )
          updateDelegationPlanAssignee(proposal.delegationPlanId, employeeId)
          updateMobileEmployeeChatMessage(canonical, message.id, {
            delegationProposal: nextProposal,
            content: `${resolveDelegationProposalIntro(copy)}\n\n«${nextProposal.taskProposal.title}» → ${nextProposal.recommendedDisplayName}`,
          })
          appendMobileEmployeeChatMessage(canonical, {
            role: 'system',
            kind: 'delegation_event',
            content: maxDelegationCopy.events.overridden.replace(
              '{employee}',
              nextProposal.recommendedDisplayName,
            ),
          })
          recordChatMemory(canonical)
          refresh()
        },
      })
    },
    [canonical, copy, maxDelegationCopy, openAssigneePicker, refresh],
  )

  const executeDelegationProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const proposal = message.delegationProposal
      if (
        !proposal ||
        (proposal.status !== 'awaiting_execution' && proposal.status !== 'delegated') ||
        !maxDelegationCopy
      ) {
        return
      }
      setActionError(null)

      try {
        const result = executeApprovedDelegationPlan(proposal.delegationPlanId)
        if (!result.ok) {
          throw new Error(result.message)
        }

        const nextProposal = { ...proposal, status: 'delegated' as const }
        updateMobileEmployeeChatMessage(canonical, message.id, {
          kind: 'delegation_event',
          delegationProposal: nextProposal,
          workItemId: result.workItem.id,
        })

        if (!result.idempotent) {
          appendMobileEmployeeChatMessage(canonical, {
            role: 'system',
            kind: 'delegation_event',
            content: maxDelegationCopy.events.transferred.replace(
              '{employee}',
              proposal.recommendedDisplayName,
            ),
          })
        }

        recordChatMemory(canonical)
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [canonical, copy.errors.generic, maxDelegationCopy, refresh],
  )

  const acceptDelegationReviewProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const review = message.delegationReview
      if (!review || review.status !== 'awaiting_review') return
      setActionError(null)

      const result = acceptDelegationReview(review.reviewId)
      if (!result.ok) {
        setActionError(result.message)
        return
      }
      refresh()
    },
    [refresh],
  )

  const reworkDelegationReviewProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      const review = message.delegationReview
      if (!review || review.status !== 'awaiting_review') return
      setActionError(null)

      const notes =
        typeof window !== 'undefined'
          ? window.prompt('Комментарий для Builder (необязательно):') ?? undefined
          : undefined

      const result = requestDelegationReviewRework(review.reviewId, notes)
      if (!result.ok) {
        setActionError(result.message)
        return
      }
      refresh()
    },
    [refresh],
  )

  return {
    status,
    timelineEntries,
    timelineFilter,
    setTimelineFilter,
    timelineFilterOptions,
    formatTimestamp,
    quickHints: copy.quickHints,
    draft,
    setDraft,
    isResponding,
    actionError,
    sendMessage,
    createTaskFromProposal,
    editTaskProposal,
    cancelTaskProposal,
    approveDelegationProposal,
    changeDelegationAssignee,
    keepDelegationWithMax,
    cancelDelegationProposal,
    executeDelegationProposal,
    acceptDelegationReviewProposal,
    reworkDelegationReviewProposal,
    refresh,
  }
}

export function useMobileMaxChat(employeeId: string = MAX_WORKER_EMPLOYEE_ID) {
  return useMobileEmployeeChat(employeeId)
}
