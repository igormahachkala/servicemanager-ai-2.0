import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'

export function ChatEmptyState(props: {
  title: string
  description: string
  action?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="mcChatEmpty">
      <div className="mcChatEmptyTitle">{props.title}</div>
      <p className="mcChatEmptyDesc">{props.description}</p>
      {props.action}
      <span className="mcChatEmptyHint">{t.chats.localOnly}</span>
    </div>
  )
}
