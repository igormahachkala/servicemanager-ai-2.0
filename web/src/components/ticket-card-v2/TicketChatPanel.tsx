import { TicketChatPanel as BaseTicketChatPanel } from '../ticket-page/TicketChatPanel'
import type { ChatMessage } from '../../lib/ticketChat'

type Props = {
  messages: ChatMessage[]
  loading: boolean
  canSend: boolean
  onSend: (text: string) => Promise<void>
}

export function TicketChatPanel(props: Props) {
  return <BaseTicketChatPanel {...props} />
}
