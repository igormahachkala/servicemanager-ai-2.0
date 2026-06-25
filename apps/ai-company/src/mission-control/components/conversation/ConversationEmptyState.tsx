import { useI18n } from '../../../i18n'

export function ConversationEmptyState(props: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="mcConversationEmpty">
      <div className="mcConversationEmptyTitle">{props.title}</div>
      <p className="mcConversationEmptyDesc">{props.description}</p>
      {props.action}
      <span className="mcConversationEmptyHint">{t.conversations.localOnly}</span>
    </div>
  )
}
