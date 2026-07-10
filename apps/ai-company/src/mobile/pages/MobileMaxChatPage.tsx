import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  getDefaultMobileEmployeeId,
  resolveMobileEmployeeFromRoute,
} from '../../domain/mobileEmployee'
import { useI18n } from '../../i18n'
import { resolveMobileEmployeeChatCopy } from '../mobileEmployeeCopy'
import { MobileChatComposer } from '../components/MobileChatComposer'
import { MobileChatMessageList } from '../components/MobileChatMessageList'
import { MobileChatQuickHints } from '../components/MobileChatQuickHints'
import { MobileChatStatusBar } from '../components/MobileChatStatusBar'
import { MobileChatTimelineFilter } from '../components/MobileChatTimelineFilter'
import { MobileBuilderToolStatusCard } from '../components/MobileBuilderToolStatusCard'
import {
  MobileBuilderCursorToolReviewProfileCard,
} from '../components/MobileBuilderCursorToolReviewCard'
import { BUILDER_EMPLOYEE_ID, mobileEmployeeChatPath } from '../../domain/mobileEmployee'
import {
  buildCursorToolReviewSnapshot,
  listPendingBuilderCursorToolReviews,
} from '../../domain/employeeToolReview'
import { getToolExecutionRun } from '../../domain/toolExecution/toolExecutionRunStorage'
import { useMobileEmployeeChat } from '../hooks/useMobileMaxChat'

export function MobileMaxChatPage() {
  const { employeeId: rawId } = useParams<{ employeeId: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const registryEntry = rawId ? resolveMobileEmployeeFromRoute(rawId) : null
  const employeeId = registryEntry?.employeeId ?? getDefaultMobileEmployeeId()
  const copy = resolveMobileEmployeeChatCopy(employeeId, t.mobile)

  if (!rawId || !registryEntry) {
    return <Navigate to={`/mobile/chat/${getDefaultMobileEmployeeId()}`} replace />
  }

  const chat = useMobileEmployeeChat(employeeId)
  const pendingCursorReview =
    employeeId === BUILDER_EMPLOYEE_ID ? listPendingBuilderCursorToolReviews()[0] ?? null : null
  const pendingCursorReviewSnapshot =
    pendingCursorReview && getToolExecutionRun(pendingCursorReview.toolExecutionRunId)
      ? buildCursorToolReviewSnapshot(
          pendingCursorReview,
          getToolExecutionRun(pendingCursorReview.toolExecutionRunId)!.title,
        )
      : null

  return (
    <div className="acMobilePage acMobileChatPage">
      <p className="acMobilePageIntro">{copy.intro}</p>

      {employeeId === BUILDER_EMPLOYEE_ID ? (
        <MobileBuilderToolStatusCard employeeId={employeeId} />
      ) : null}

      {pendingCursorReviewSnapshot ? (
        <MobileBuilderCursorToolReviewProfileCard
          review={pendingCursorReviewSnapshot}
          onOpenChat={() => navigate(mobileEmployeeChatPath(BUILDER_EMPLOYEE_ID))}
        />
      ) : null}

      <MobileChatStatusBar status={chat.status} />

      <MobileChatTimelineFilter
        value={chat.timelineFilter}
        options={chat.timelineFilterOptions}
        ariaLabel={copy.timeline.filterAria}
        onChange={chat.setTimelineFilter}
      />

      <MobileChatMessageList
        entries={chat.timelineEntries}
        formatTimestamp={chat.formatTimestamp}
        onCreateTask={(message) => chat.createTaskFromProposal(message, false)}
        onRunNow={(message) => chat.createTaskFromProposal(message, true)}
        onEditTask={(message) => chat.editTaskProposal(message)}
        onCancelProposal={(message) => chat.cancelTaskProposal(message)}
        onApproveDelegation={(message) => chat.approveDelegationProposal(message)}
        onChangeDelegationAssignee={(message) => chat.changeDelegationAssignee(message)}
        onKeepDelegationWithMax={(message) => chat.keepDelegationWithMax(message)}
        onCancelDelegation={(message) => chat.cancelDelegationProposal(message)}
        onExecuteDelegation={(message) => chat.executeDelegationProposal(message)}
        onAcceptDelegationReview={(message) => chat.acceptDelegationReviewProposal(message)}
        onReworkDelegationReview={(message) => chat.reworkDelegationReviewProposal(message)}
        onAcceptCursorToolReview={(message) => chat.acceptCursorToolReviewProposal(message)}
        onReworkCursorToolReview={(message) => chat.reworkCursorToolReviewProposal(message)}
        onRejectCursorToolReview={(message) => chat.rejectCursorToolReviewProposal(message)}
        onHandoffUpdated={chat.refresh}
      />

      {chat.actionError ? (
        <p className="acMobileFieldError acMobileChatActionError" role="alert">
          {chat.actionError}
        </p>
      ) : null}

      <MobileChatQuickHints
        hints={chat.quickHints}
        disabled={chat.isResponding}
        onSelect={(hint) => void chat.sendMessage(hint)}
      />

      <MobileChatComposer
        value={chat.draft}
        placeholder={copy.inputPlaceholder}
        sendLabel={copy.send}
        disabled={chat.isResponding}
        onChange={chat.setDraft}
        onSubmit={() => void chat.sendMessage(chat.draft)}
      />
    </div>
  )
}
