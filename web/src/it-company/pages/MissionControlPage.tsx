import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { canViewITCompany } from '../access'
import {
  MISSION_CONTROL_ACTIVITY,
  MISSION_CONTROL_INSPECTOR,
  MISSION_CONTROL_NAV,
  MISSION_CONTROL_WORKSPACE,
} from '../mission-control/mockData'

const STATUS_COLOR: Record<'ok' | 'warn' | 'danger', string> = {
  ok: '#22c55e',
  warn: '#f59e0b',
  danger: '#ef4444',
}

function SectionLabel(props: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>{props.subtitle}</div>
    </div>
  )
}

export function MissionControlPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canView = canViewITCompany(meQ.data)

  if (meQ.isLoading) {
    return <div className="muted">Загрузка…</div>
  }
  if (!canView) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Раздел недоступен</div>
        <div className="muted small">Раздел IT Company доступен только администратору платформы.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Mission Control</h2>
          <div className="muted small">Каркас будущего рабочего центра цифровой команды.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="tag">layout only</span>
          <Link to="/it" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">← IT Company</button>
          </Link>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr) 280px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <aside className="panel" style={{ padding: 16, display: 'grid', gap: 14, minHeight: 620 }}>
          <SectionLabel title="Sidebar" subtitle="Навигация Mission Control" />
          <div style={{ display: 'grid', gap: 8 }}>
            {MISSION_CONTROL_NAV.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: '#fff',
                  display: 'grid',
                  gap: 2,
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div className="muted small">{item.hint}</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="panel" style={{ padding: 16, display: 'grid', gap: 16, minHeight: 620 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <SectionLabel title="Topbar" subtitle="Зона контекста и быстрых действий" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="tag">Workspace: Mission Control</span>
              <span className="tag">Mode: Foundation</span>
              <span className="tag">Status: Mock</span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <SectionLabel title="Main Workspace" subtitle="Центральная рабочая область" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              {MISSION_CONTROL_WORKSPACE.map((card) => (
                <div
                  key={card.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: 14,
                    minHeight: 118,
                    display: 'grid',
                    alignContent: 'space-between',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{card.title}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: '#0f172a' }}>{card.value}</div>
                  </div>
                  <div className="muted small">{card.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <SectionLabel title="Main Workspace" subtitle="Рабочие зоны без финального дизайна" />
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, minHeight: 280 }}>
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 16, background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }} />
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 16, background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }} />
            </div>
          </div>
        </main>

        <aside className="panel" style={{ padding: 16, display: 'grid', gap: 14, minHeight: 620 }}>
          <SectionLabel title="Right Inspector Panel" subtitle="Сводка по состоянию Mission Control" />
          <div style={{ display: 'grid', gap: 8 }}>
            {MISSION_CONTROL_INSPECTOR.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div className="muted small">{item.value}</div>
                </div>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: STATUS_COLOR[item.status],
                    flex: '0 0 auto',
                  }}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="panel" style={{ padding: 16, display: 'grid', gap: 14 }}>
        <SectionLabel title="Bottom Activity Panel" subtitle="Живая лента активности сотрудников" />
        <div style={{ display: 'grid', gap: 10 }}>
          {MISSION_CONTROL_ACTIVITY.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr 1fr',
                gap: 12,
                padding: '12px 0',
                borderTop: '1px solid #e2e8f0',
                alignItems: 'start',
              }}
            >
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.time}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{item.employee}</div>
                <div className="muted small">{item.title}</div>
              </div>
              <div className="muted small" style={{ lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
