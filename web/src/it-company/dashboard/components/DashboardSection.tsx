import type { ReactNode } from 'react'

/** Generic titled panel used to frame dashboard sections. */
export function DashboardSection(props: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 10, alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>{props.title}</h3>
        {props.action ?? null}
      </div>
      {props.children}
    </div>
  )
}
