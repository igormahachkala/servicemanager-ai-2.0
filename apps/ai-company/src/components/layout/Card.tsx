import type { ReactNode } from 'react'

export function Card(props: {
  title?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const className = props.className ? `acCard ${props.className}` : 'acCard'

  return (
    <div className={className}>
      {props.title ? (
        <div className="acCardHeader">
          <span className="acCardTitle">{props.title}</span>
          {props.action}
        </div>
      ) : null}
      <div className="acCardBody">{props.children}</div>
      {props.footer ? <div className="acCardFooter">{props.footer}</div> : null}
    </div>
  )
}
