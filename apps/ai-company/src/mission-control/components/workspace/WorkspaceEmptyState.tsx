import type { ReactNode } from 'react'
import { useI18n } from '../../../i18n'

export function WorkspaceEmptyState(props: {
  title: string
  description: string
  action?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="mcWorkspaceEmpty">
      <div className="mcWorkspaceEmptyTitle">{props.title}</div>
      <p className="mcWorkspaceEmptyDesc">{props.description}</p>
      {props.action}
      <span className="mcWorkspaceEmptyHint">{t.workspaces.localOnly}</span>
    </div>
  )
}
