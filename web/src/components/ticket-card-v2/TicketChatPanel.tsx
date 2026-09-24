import { TicketChatPanel as BaseTicketChatPanel } from '../ticket-page/TicketChatPanel'
import type { AddTicketCommentOptions } from '../../lib/api'
import type { ChatMessage } from '../../lib/ticketChat'

type Props = {
  messages: ChatMessage[]
  loading: boolean
  canSend: boolean
  onSend: (text: string, options?: AddTicketCommentOptions) => Promise<void>
}

export function TicketChatPanel(props: Props) {
  return <BaseTicketChatPanel {...props} />
}
