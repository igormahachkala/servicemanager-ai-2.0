import type { ReactNode } from 'react'

export function PageHeader(props: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="acPageHeader">
      <div className="acPageHeaderRow">
        <div>
          <h1 className="acPageTitle">{props.title}</h1>
          {props.description ? <p className="acPageDesc">{props.description}</p> : null}
        </div>
        {props.actions}
      </div>
    </header>
  )
}
