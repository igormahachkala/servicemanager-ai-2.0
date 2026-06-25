import type { ReactNode } from 'react'

export function CompanyEmptyState(props: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="mcEmptyState">
      <h3 className="mcEmptyStateTitle">{props.title}</h3>
      <p className="mcMuted">{props.description}</p>
      {props.action ? <div className="mcEmptyStateAction">{props.action}</div> : null}
    </div>
  )
}
