import type { ReactNode } from 'react'

export function DashboardSection(props: {
  title: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          {props.eyebrow ? (
            <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {props.eyebrow}
            </div>
          ) : null}
          <h3 style={{ margin: 0 }}>{props.title}</h3>
        </div>
        {props.action ?? null}
      </div>
      {props.children}
    </section>
  )
}
