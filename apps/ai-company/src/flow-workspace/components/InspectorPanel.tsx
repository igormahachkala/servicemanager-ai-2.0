import type { CSSProperties, ReactNode } from 'react';
import type { Employee, EmployeeStatus } from '../types';
import { STATUS_META } from '../lib/status';
import { ShapeGlyph } from '../lib/shapes';
import { FONT_MONO } from '../lib/tokens';
import { StatusDot } from './StatusDot';
import { useI18n } from '../../i18n';

interface Props {
  employee: Employee;
  onCollapse: () => void;
}

const AI_ICON_BG = 'radial-gradient(circle at 30% 25%,rgba(139,124,255,.3),rgba(139,124,255,.06))';
const labelStyle: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: '.13em',
  textTransform: 'uppercase',
  color: '#5b6068',
  fontWeight: 600,
  marginBottom: 6,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

function statusLabel(status: EmployeeStatus, t: ReturnType<typeof useI18n>['t']) {
  return t.status[status] ?? STATUS_META[status].label;
}

/** Employee Inspector — V1 profile panel for selected flow node. */
export function InspectorPanel({ employee, onCollapse }: Props) {
  const { t } = useI18n();
  const meta = STATUS_META[employee.status];
  const isPlanned = employee.lifecycle === 'planned';
  const hasProgress = employee.progress != null && !isPlanned;
  const lastActivity = employee.activity?.[0];

  return (
    <aside
      style={{
        gridColumn: 3,
        gridRow: '2 / 4',
        background: '#0c0d10',
        borderLeft: '1px solid rgba(255,255,255,.06)',
        overflow: 'hidden auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7c828c', fontWeight: 600 }}>
          {t.inspector.title}
        </span>
        <button
          className="itc-btn"
          title={t.inspector.collapse}
          onClick={onCollapse}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#7c828c',
            background: 'transparent',
            border: 'none',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              flex: 'none',
              background: AI_ICON_BG,
              border: '1px solid rgba(139,124,255,.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isPlanned ? 0.55 : 1,
            }}
          >
            <ShapeGlyph shape={employee.shape} size={20} color="#b3b9ff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#f0f1f3' }}>{employee.name}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: 5,
                  color: isPlanned ? '#9aa0aa' : '#3fb950',
                  border: `1px solid ${isPlanned ? 'rgba(255,255,255,.12)' : 'rgba(63,185,80,.35)'}`,
                  background: isPlanned ? 'rgba(255,255,255,.04)' : 'rgba(63,185,80,.1)',
                }}
              >
                {isPlanned ? t.labels.planned.toLowerCase() : t.labels.active.toLowerCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#9aa0aa', marginTop: 4 }}>{employee.role}</div>
          </div>
        </div>

        <Field label={t.labels.status}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot status={employee.status} size={8} />
            <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>
              {statusLabel(employee.status, t)}
            </span>
            {!isPlanned && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#5b6068', marginLeft: 'auto' }}>
                {t.inspector.lastRun} {employee.lastRun}
              </span>
            )}
          </div>
        </Field>

        <Field label={t.labels.currentTask}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 10,
              padding: 12,
              background: 'rgba(255,255,255,.02)',
            }}
          >
            <div style={{ fontSize: 13, color: '#dfe2e7', lineHeight: 1.5 }}>{employee.task}</div>
            {hasProgress && (
              <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 11 }}>
                <div
                  style={{
                    width: `${employee.progress}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: 'linear-gradient(90deg,#7c8cf8,#a78bff)',
                  }}
                />
              </div>
            )}
          </div>
        </Field>

        <Field label={t.labels.model}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid rgba(139,124,255,.25)',
              borderRadius: 9,
              background: 'rgba(139,124,255,.07)',
            }}
          >
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: '#cfc8ff' }}>{employee.model}</span>
          </div>
        </Field>

        <Field label={t.labels.availableTools}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {employee.mcp.map((tool) => (
              <div
                key={tool}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  border: '1px solid rgba(255,255,255,.09)',
                  borderRadius: 7,
                  background: 'rgba(255,255,255,.03)',
                  fontSize: 11.5,
                  color: '#c1c6cd',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: isPlanned ? '#5b6068' : '#3fb950' }} />
                {tool}
              </div>
            ))}
          </div>
        </Field>

        <Field label={t.labels.lastActivity}>
          {lastActivity ? (
            <div
              style={{
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 9,
                padding: '10px 12px',
                background: 'rgba(255,255,255,.02)',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#cfd3da', lineHeight: 1.45 }}>{lastActivity.text}</div>
              <div style={{ fontSize: 10, color: '#5b6068', marginTop: 4, fontFamily: FONT_MONO }}>
                {lastActivity.t === '—'
                  ? t.inspector.noEventsYet
                  : `${lastActivity.t} ${t.inspector.ago}`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#5b6068' }}>{t.inspector.noRecentActivity}</div>
          )}
        </Field>

        {!!employee.activity && employee.activity.length > 1 && (
          <Field label={t.inspector.activityTimeline}>
            {employee.activity.slice(1, 4).map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,.05)' : undefined,
                  fontSize: 11.5,
                }}
              >
                <span style={{ color: '#9aa0aa', flex: 1 }}>{a.text}</span>
                <span style={{ fontFamily: FONT_MONO, color: '#5b6068', flex: 'none' }}>{a.t}</span>
              </div>
            ))}
          </Field>
        )}
      </div>
    </aside>
  );
}
