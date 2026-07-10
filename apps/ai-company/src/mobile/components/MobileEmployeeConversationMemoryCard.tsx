import { Link } from 'react-router-dom'
import type { EmployeeConversationContext } from '../../domain/conversationMemory'
import { mobileEmployeeChatPath } from '../../domain/mobileEmployee'
import { MobileCard } from './MobileCard'

export type MobileEmployeeConversationMemoryCopy = {
  description: string
  summary: string
  workingMemory: string
  currentlyDoing: string
  promisedToDo: string
  awaitingConfirmation: string
  empty: string
  openChat: string
  stats: string
}

type Props = {
  employeeId: string
  context: EmployeeConversationContext
  messageCount: number
  copy: MobileEmployeeConversationMemoryCopy
}

export function MobileEmployeeConversationMemoryCard({
  employeeId,
  context,
  messageCount,
  copy,
}: Props) {
  const { workingMemory, conversationSummary } = context
  const hasWorkingMemory =
    workingMemory.currentlyDoing.length > 0 ||
    workingMemory.promisedToDo.length > 0 ||
    workingMemory.awaitingConfirmation.length > 0 ||
    Boolean(conversationSummary)

  if (!hasWorkingMemory && messageCount === 0) {
    return (
      <MobileCard title={copy.workingMemory} description={copy.description}>
        <p className="acMobileOwnerHomeMuted">{copy.empty}</p>
        <div className="acMobileCardActions">
          <Link to={mobileEmployeeChatPath(employeeId)} className="acMobilePrimaryBtn">
            {copy.openChat}
          </Link>
        </div>
      </MobileCard>
    )
  }

  return (
    <MobileCard title={copy.workingMemory} description={copy.description}>
      <p className="acMobileRegistryProfileText">{copy.stats.replace('{count}', String(messageCount))}</p>

      {conversationSummary ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.summary}</h3>
          <p className="acMobileRegistryProfileText">{conversationSummary}</p>
        </section>
      ) : null}

      {workingMemory.currentlyDoing.length > 0 ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.currentlyDoing}</h3>
          <ul className="acMobileRegistryProfileList">
            {workingMemory.currentlyDoing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {workingMemory.promisedToDo.length > 0 ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.promisedToDo}</h3>
          <ul className="acMobileRegistryProfileList">
            {workingMemory.promisedToDo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {workingMemory.awaitingConfirmation.length > 0 ? (
        <section className="acMobileRegistryProfileSection">
          <h3 className="acMobileRegistryProfileHeading">{copy.awaitingConfirmation}</h3>
          <ul className="acMobileRegistryProfileList">
            {workingMemory.awaitingConfirmation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="acMobileCardActions">
        <Link to={mobileEmployeeChatPath(employeeId)} className="acMobileSecondaryBtn">
          {copy.openChat}
        </Link>
      </div>
    </MobileCard>
  )
}
