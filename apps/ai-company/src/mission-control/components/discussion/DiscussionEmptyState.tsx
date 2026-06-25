import { useI18n } from '../../../i18n'

export function DiscussionEmptyState(props: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="mcDiscussionEmpty">
      <div className="mcDiscussionEmptyTitle">{props.title}</div>
      <p className="mcDiscussionEmptyDesc">{props.description}</p>
      {props.action}
      <span className="mcDiscussionEmptyHint">{t.discussions.localOnly}</span>
    </div>
  )
}
