import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'

export function ProjectEmptyState(props: {
  title: string
  description: string
  action?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="acProjectEmpty">
      <div className="acProjectEmptyTitle">{props.title}</div>
      <p className="acProjectEmptyDesc">{props.description}</p>
      {props.action}
      <span className="acProjectEmptyHint">{t.projects.localOnly}</span>
    </div>
  )
}
