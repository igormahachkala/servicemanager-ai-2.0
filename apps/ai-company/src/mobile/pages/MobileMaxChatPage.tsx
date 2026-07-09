import { Navigate, useParams } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { useI18n } from '../../i18n'
import { MobileChatComposer } from '../components/MobileChatComposer'
import { MobileChatMessageList } from '../components/MobileChatMessageList'
import { MobileChatQuickHints } from '../components/MobileChatQuickHints'
import { MobileChatStatusBar } from '../components/MobileChatStatusBar'
import { MobileChatTimelineFilter } from '../components/MobileChatTimelineFilter'
import { useMobileMaxChat } from '../hooks/useMobileMaxChat'

export function MobileMaxChatPage() {
  const { employeeId: rawId } = useParams<{ employeeId: string }>()
  const { t } = useI18n()
  const copy = t.mobile.maxChat

  const resolvedId = rawId ? resolveCanonicalEmployeeId(rawId) : MAX_WORKER_EMPLOYEE_ID
  if (resolvedId !== MAX_WORKER_EMPLOYEE_ID) {
    return <Navigate to={`/mobile/chat/${MAX_WORKER_EMPLOYEE_ID}`} replace />
  }

  const chat = useMobileMaxChat(resolvedId)

  return (
    <div className="acMobilePage acMobileChatPage">
      <p className="acMobilePageIntro">{copy.intro}</p>

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
