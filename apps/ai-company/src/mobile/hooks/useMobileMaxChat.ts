import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT } from '../../domain/cursorHandoffFromChat/cursorHandoffFromChatStorage'
import { tryProcessMobileCursorHandoffFromOwnerMessage } from '../../domain/cursorHandoffFromChat'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop/maxWorkerLoopStorage'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { useI18n } from '../../i18n'
import type { MobileEmployeeChatMessage } from '../chat/mobileEmployeeChat'
import { MOBILE_EMPLOYEE_CHAT_SYNC_EVENT } from '../chat/mobileEmployeeChat'
import { createWorkItemFromChatProposal } from '../chat/mobileChatTaskBridge'
import { stashMobileChatTaskPrefill } from '../chat/mobileChatTaskPrefill'
import {
  buildMobileChatTimeline,
  filterMobileChatTimelineEntries,
  MOBILE_CHAT_TIMELINE_FILTERS,
  type MobileChatTimelineFilterId,
  type MobileChatTimelineLabels,
} from '../chat/mobileChatTimeline'
import {
  appendMobileEmployeeChatMessage,
  getMobileEmployeeChatSession,
  updateMobileEmployeeChatMessage,
} from '../chat/mobileEmployeeChatStorage'
import {
  classifyOwnerChatMessage,
  respondToOwnerChatMessage,
} from '../chat/mobileMaxChatResponder'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import { useMobileRunNextSheet } from './useMobileRunNextSheet'

const APPROVAL_SYNC_EVENT = 'ai-company-approval-sync'

export type MobileMaxChatStatus = {
  label: string
  detail: string | null
  tone: 'default' | 'live' | 'waiting' | 'offline'
}

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
  }
}

export function useMobileMaxChat(employeeId: string = MAX_WORKER_EMPLOYEE_ID) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat
  const navigate = useNavigate()
  const { openRunNextFlow } = useMobileRunNextSheet()

  const [sessionTick, setSessionTick] = useState(0)
  const [draft, setDraft] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [timelineFilter, setTimelineFilter] = useState<MobileChatTimelineFilterId>('all')

  const refresh = useCallback(() => {
    setSessionTick((value) => value + 1)
  }, [])

  useEffect(() => {
    getMobileEmployeeChatSession(employeeId, { welcome: copy.welcome })
  }, [copy.welcome, employeeId])

  useEffect(() => {
    const onSync = () => refresh()
    const events = [
      MOBILE_EMPLOYEE_CHAT_SYNC_EVENT,
      CURSOR_HANDOFF_FROM_CHAT_SYNC_EVENT,
      EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
      MAX_WORKER_LOOP_SYNC_EVENT,
      EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT,
      APPROVAL_SYNC_EVENT,
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
  const session = getMobileEmployeeChatSession(employeeId, { welcome: copy.welcome })
  const messages = session.messages

  const timelineLabels = useMemo(() => buildTimelineLabels(copy.timeline), [copy.timeline])

  const timelineEntries = useMemo(
    () =>
      filterMobileChatTimelineEntries(
        buildMobileChatTimeline({
          employeeId,
          messages,
          labels: timelineLabels,
        }),
        timelineFilter,
      ),
    [employeeId, messages, timelineFilter, timelineLabels],
  )

  const timelineFilterOptions = useMemo(
    () =>
      MOBILE_CHAT_TIMELINE_FILTERS.map((id) => ({
        id,
        label: copy.timeline.filters[id],
      })),
    [copy.timeline.filters],
  )

  const status: MobileMaxChatStatus = useMemo(() => {
    const activeLoop = loadMaxWorkerLoopRecords().find(
      (loop) =>
        loop.status === 'running' ||
        loop.status === 'queued' ||
        loop.status === 'waiting_approval',
    )
    if (activeLoop) {
      return {
        label: copy.status.live,
        detail: activeLoop.input.title?.slice(0, 80) ?? null,
        tone: 'live',
      }
    }
    if (isResponding) {
      return { label: copy.status.thinking, detail: null, tone: 'waiting' }
    }
    return { label: copy.status.ready, detail: copy.status.readyHint, tone: 'default' }
  }, [copy.status, isResponding])

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim()
      if (!content || isResponding) return

      setActionError(null)
      setDraft('')
      setIsResponding(true)

      const ownerKind = classifyOwnerChatMessage(content)
      const ownerMessage = appendMobileEmployeeChatMessage(employeeId, {
        role: 'owner',
        kind: ownerKind,
        content,
      })

      const recentOwner = messages
        .filter((item) => item.role === 'owner')
        .slice(-5)
        .map((item) => item.content)
      recentOwner.push(content)

      const handoff = tryProcessMobileCursorHandoffFromOwnerMessage({
        employeeId,
        ownerMessageId: ownerMessage.id,
        ownerContent: content,
        recentOwnerMessages: recentOwner,
      })

      if (handoff) {
        appendMobileEmployeeChatMessage(employeeId, {
          role: 'max',
          kind: 'cursor_handoff',
          content: copy.cursorHandoff.cardTitle,
          cursorHandoffId: handoff.handoffId,
        })
        refresh()
        setIsResponding(false)
        return
      }

      const pendingId = appendMobileEmployeeChatMessage(employeeId, {
        role: 'max',
        kind: 'clarification',
        content: copy.status.thinking,
        pending: true,
      }).id

      try {
        const response = await respondToOwnerChatMessage({
          text: content,
          sourceMessageId: ownerMessage.id,
          taskProposalIntro: copy.taskProposalIntro,
          reportLinkIntro: (title) => copy.reportLinkIntro.replace('{title}', title),
          questionFallback: copy.questionFallback,
        })

        updateMobileEmployeeChatMessage(employeeId, pendingId, {
          kind: response.maxKind,
          content: response.errorMessage
            ? `${copy.errors.ollama}\n${response.errorMessage}`
            : response.content,
          pending: false,
          error: Boolean(response.errorMessage),
          taskProposal: response.taskProposal ?? null,
          reportId: response.reportId,
          runtimeRunId: response.runtimeRunId,
          workerLoopId: response.workerLoopId,
        })
      } catch (error) {
        updateMobileEmployeeChatMessage(employeeId, pendingId, {
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
    [copy, employeeId, isResponding, messages, refresh],
  )

  const createTaskFromProposal = useCallback(
    (message: MobileEmployeeChatMessage, runNow: boolean) => {
      if (!message.taskProposal || message.workItemId) return
      setActionError(null)

      try {
        const workItem = createWorkItemFromChatProposal(message.taskProposal)
        updateMobileEmployeeChatMessage(employeeId, message.id, {
          workItemId: workItem.id,
          content: `${message.content}\n\n${copy.taskCreated.replace('{title}', workItem.title)}`,
        })

        appendMobileEmployeeChatMessage(employeeId, {
          role: 'system',
          kind: 'system_status',
          content: copy.taskQueued.replace('{id}', workItem.id),
        })

        if (runNow) {
          openRunNextFlow({ workItem, goldenPath: true })
        }
        refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : copy.errors.generic)
      }
    },
    [copy, employeeId, openRunNextFlow, refresh],
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
      navigate(MOBILE_PATHS.tasksNewMax)
    },
    [navigate],
  )

  const cancelTaskProposal = useCallback(
    (message: MobileEmployeeChatMessage) => {
      updateMobileEmployeeChatMessage(employeeId, message.id, {
        taskProposal: null,
        kind: 'clarification',
        content: copy.proposalCancelled,
      })
      refresh()
    },
    [copy.proposalCancelled, employeeId, refresh],
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
    refresh,
  }
}
