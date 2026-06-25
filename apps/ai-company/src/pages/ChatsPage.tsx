import { Link } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { ChatList } from '../components/chats/ChatList'
import { ChatEmptyState } from '../components/chats/ChatEmptyState'
import { useChats } from '../hooks/useChats'
import { useI18n } from '../i18n'

export function ChatsPage() {
  const { t } = useI18n()
  const { chats } = useChats()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.chats} description={t.chats.listDescription} />
        <Link to="/ops/notifications?type=chat" className="mcBtn mcBtnSecondary">
          {t.notificationEngine.chatInbox}
        </Link>
        <Link to="/ops/chats/new" className="mcBtn mcBtnPrimary">
          {t.chats.newChat}
        </Link>
      </div>

      {chats.length === 0 ? (
        <ChatEmptyState
          title={t.chats.emptyListTitle}
          description={t.chats.emptyListDescription}
          action={
            <Link to="/ops/chats/new" className="mcBtn mcBtnPrimary">
              {t.chats.newChat}
            </Link>
          }
        />
      ) : (
        <div className="mcChatMessengerLayout">
          <aside className="mcChatMessengerSidebar">
            <ChatList chats={chats} />
          </aside>
          <section className="mcChatMessengerMain">
            <ChatEmptyState
              title={t.chats.selectChatTitle}
              description={t.chats.selectChatDescription}
            />
          </section>
        </div>
      )}
    </>
  )
}
