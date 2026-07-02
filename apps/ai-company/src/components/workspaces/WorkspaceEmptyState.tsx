import type { ReactNode } from 'react'
import { ContextEmptyState } from '../empty-states'

export function WorkspaceEmptyState(props: {
  variant?: 'initial' | 'filtered'
  action?: ReactNode
}) {
  return (
    <ContextEmptyState
      area="workspace"
      variant={props.variant ?? 'initial'}
      action={props.action}
      className="mcWorkspaceEmptyWrap"
    />
  )
}
