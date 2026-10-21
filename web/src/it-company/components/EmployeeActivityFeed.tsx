import type { CSSProperties } from 'react'
import { getProfileBySlug } from '../employees/profiles'
import {
  EMPLOYEE_ACTIVITY,
  type EmployeeActivityItem,
  type EmployeeActivityType,
  getEmployeeActivityEmployeeName,
} from '../activity/mockActivity'

const EVENT_META: Record<
  EmployeeActivityType,
  { icon: string; accent: string; glow: string; label: string }
> = {
  TASK_CREATED: { icon: '◆', accent: '#60a5fa', glow: 'rgba(96, 165, 250, 0.18)', label: 'Task created' },
  TASK_STARTED: { icon: '↻', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.18)', label: 'Task started' },
  TASK_COMPLETED: { icon: '✓', accent: '#34d399', glow: 'rgba(52, 211, 153, 0.18)', label: 'Task completed' },
  TASK_FAILED: { icon: '✕', accent: '#f87171', glow: 'rgba(248, 113, 113, 0.18)', label: 'Task failed' },
  BUILD_STARTED: { icon: '◫', accent: '#a78bfa', glow: 'rgba(167, 139, 250, 0.18)', label: 'Build started' },
  BUILD_SUCCESS: { icon: '⬢', accent: '#22c55e', glow: 'rgba(34, 197, 94, 0.18)', label: 'Build success' },
  BUILD_FAILED: { icon: '⚠', accent: '#ef4444', glow: 'rgba(239, 68, 68, 0.18)', label: 'Build failed' },
  PR_OPENED: { icon: '⇢', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.18)', label: 'PR opened' },
  PR_MERGED: { icon: '≡', accent: '#10b981', glow: 'rgba(16, 185, 129, 0.18)', label: 'PR merged' },
  MCP_CONNECTED: { icon: '⟡', accent: '#c084fc', glow: 'rgba(192, 132, 252, 0.18)', label: 'MCP connected' },
}

export interface EmployeeActivityFeedProps {
  activities?: EmployeeActivityItem[]
  title?: string
  maxItems?: number
  className?: string
}

function formatActivityTime(timestamp: string): string {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function ActivityRow({ item }: { item: EmployeeActivityItem }) {
  const meta = EVENT_META[item.type]
  const employeeName = getEmployeeActivityEmployeeName(item.employeeId)
  const employeeProfile = getProfileBySlug(item.employeeId)

  return (
    <div style={styles.row}>
      <div style={styles.rail} aria-hidden>
        <span
          style={{
            ...styles.icon,
            background: meta.glow,
            color: meta.accent,
            borderColor: meta.accent,
          }}
        >
          {meta.icon}
        </span>
        <span style={styles.line} />
      </div>

      <div style={styles.content}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <span style={styles.title}>{item.title}</span>
            <span style={styles.employee}>
              {employeeName}
              {employeeProfile?.codename ? <span style={styles.codename}> · {employeeProfile.codename}</span> : null}
            </span>
          </div>
          <div style={styles.time}>{formatActivityTime(item.timestamp)}</div>
        </div>

        <div style={styles.description}>{item.description}</div>

        <div style={styles.metaRow}>
          <span style={{ ...styles.badge, borderColor: meta.accent, color: meta.accent }}>{meta.label}</span>
          <span style={styles.employeeId}>{item.employeeId}</span>
        </div>
      </div>
    </div>
  )
}

export function EmployeeActivityFeed({
  activities = EMPLOYEE_ACTIVITY,
  title = 'Employee activity',
  maxItems,
  className,
}: EmployeeActivityFeedProps) {
  const items = typeof maxItems === 'number' ? activities.slice(0, maxItems) : activities

  return (
    <section style={styles.shell} className={className}>
      <div style={styles.surface}>
        <div style={styles.headingRow}>
          <div>
            <div style={styles.kicker}>Mission Control</div>
            <h3 style={styles.heading}>{title}</h3>
          </div>
          <div style={styles.count}>{items.length} events</div>
        </div>

        <div style={styles.feed}>
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: '100%',
  },
  surface: {
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(3, 7, 18, 0.98) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(2, 6, 23, 0.45)',
    overflow: 'hidden',
  },
  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '18px 18px 14px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  },
  kicker: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
  },
  heading: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.2,
    color: '#e2e8f0',
    fontWeight: 700,
  },
  count: {
    fontSize: 12,
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.12)',
    borderRadius: 999,
    padding: '6px 10px',
    whiteSpace: 'nowrap',
  },
  feed: {
    display: 'grid',
    gap: 0,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    gap: 14,
    padding: '16px 18px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
  },
  rail: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 2,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: '1px solid currentColor',
    display: 'grid',
    placeItems: 'center',
    fontSize: 13,
    fontWeight: 800,
    boxShadow: '0 0 0 4px rgba(15, 23, 42, 1)',
  },
  line: {
    width: 1,
    flex: 1,
    background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.32), rgba(148, 163, 184, 0.04))',
    marginTop: 8,
    minHeight: 18,
  },
  content: {
    minWidth: 0,
    display: 'grid',
    gap: 8,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  headerLeft: {
    minWidth: 0,
    display: 'grid',
    gap: 2,
  },
  title: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  employee: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  codename: {
    color: '#64748b',
  },
  time: {
    flex: '0 0 auto',
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    paddingTop: 1,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid transparent',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.01em',
    background: 'rgba(15, 23, 42, 0.9)',
  },
  employeeId: {
    color: '#64748b',
    fontSize: 12,
  },
}
