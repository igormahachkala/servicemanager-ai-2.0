import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import { getProfileBySlug, type AIEmployeeStatus } from '../employees'

function statusStyle(status: AIEmployeeStatus): React.CSSProperties {
  return status === 'Active'
    ? { background: '#16a34a', color: '#fff' }
    : { background: '#e5e7eb', color: '#374151' }
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 14, marginTop: 12 }}>
      <div className="small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7, marginBottom: 8 }}>
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function Chips(props: { items: string[]; empty: string }) {
  if (!props.items.length) return <div className="muted small">{props.empty}</div>
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {props.items.map((i) => (
        <span key={i} className="tag">{i}</span>
      ))}
    </div>
  )
}

function Bullets(props: { items: string[]; empty: string }) {
  if (!props.items.length) return <div className="muted small">{props.empty}</div>
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
      {props.items.map((i) => (
        <li key={i} className="small">{i}</li>
      ))}
    </ul>
  )
}

export function AIEmployeeDetailsPage() {
  const { slug } = useParams<{ slug: string }>()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  // UI-доступ строго по роли. Backend guard остаётся источником истины для API.
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Раздел IT Company доступен только администратору платформы.</div>
      </div>
    )
  }

  const profile = slug ? getProfileBySlug(slug) : undefined
  if (!profile) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Сотрудник не найден</div>
        <div className="muted small" style={{ marginBottom: 10 }}>Профиль «{slug}» не существует.</div>
        <Link to="/it/employees" style={{ textDecoration: 'none' }}>
          <button type="button" className="ghost">← AI Employees</button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>
            {profile.name}
            {profile.codename ? <span className="muted" style={{ fontWeight: 400 }}> · {profile.codename}</span> : null}
          </h2>
          <div className="muted small">Цифровой сотрудник IT Company</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag" style={statusStyle(profile.status)}>{profile.status}</span>
          <Link to="/it/employees" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">← AI Employees</button>
          </Link>
        </div>
      </div>

      <Section title="Mission">
        <div className="small">{profile.mission}</div>
      </Section>

      <Section title="Workspace">
        <div className="small">{profile.workspace} · модель: {profile.model}</div>
      </Section>

      <Section title="MCP Access">
        <Chips items={profile.mcpAccess} empty="Доступ не назначен." />
      </Section>

      <Section title="Capabilities">
        <Bullets items={profile.capabilities} empty="Пока нет — роль запланирована." />
      </Section>

      <Section title="Planned Features">
        <Bullets items={profile.plannedFeatures} empty="—" />
      </Section>
    </div>
  )
}
