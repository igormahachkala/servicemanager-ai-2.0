import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { ChatHeader } from '../components/chats/ChatHeader'
import { ChatMessageList } from '../components/chats/ChatMessageList'
import { ChatComposer } from '../components/chats/ChatComposer'
import { ChatSidebar } from '../components/chats/ChatSidebar'
import { ChatList } from '../components/chats/ChatList'
import { ChatEmptyState } from '../components/chats/ChatEmptyState'
import { isChatWritable } from '../domain/chats/chatStorage'
import { useChat } from '../hooks/useChat'
import { useChats } from '../hooks/useChats'
import { useI18n } from '../i18n'

export function ChatPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const chatId = rawId ? decodeURIComponent(rawId) : undefined
  const { t } = useI18n()
  const { chats } = useChats()
  const [sending, setSending] = useState(false)

  const labels = useMemo(
    () => ({
      ownerName: t.chats.ownerName,
      mockReplies: t.chats.mockReplies,
    }),
    [t],
  )

  const { chat, sendOwnerMessage } = useChat(chatId)

  if (!chatId || !chat) {
    return (
      <>
        <PageHeader title={t.chats.notFoundTitle} description={t.chats.notFoundDescription} />
        <ChatEmptyState
          title={t.chats.notFoundTitle}
          description={t.chats.notFoundDescription}
          action={
            <Link to="/ops/chats" className="mcBtn mcBtnPrimary">
              {t.chats.backToList}
            </Link>
          }
        />
      </>
    )
  }

  const writable = isChatWritable(chat)

  const handleSend = (content: string) => {
    if (!writable) return
    setSending(true)
    sendOwnerMessage(content, labels)
    setSending(false)
  }

  return (
    <div className="mcChatPage">
      <div className="mcChatMessengerLayout mcChatMessengerLayoutFull">
        <aside className="mcChatMessengerSidebar">
          <ChatList chats={chats} activeChatId={chat.id} />
        </aside>

        <section className="mcChatMessengerMain">
          <ChatHeader chat={chat} />
          <div className="mcChatLayout">
            <div className="mcChatMain">
              <ChatMessageList messages={chat.messages} participants={chat.participants} />
              <ChatComposer disabled={!writable || sending} onSend={handleSend} />
            </div>
            <ChatSidebar chat={chat} />
          </div>
        </section>
      </div>
    </div>
  )
}
