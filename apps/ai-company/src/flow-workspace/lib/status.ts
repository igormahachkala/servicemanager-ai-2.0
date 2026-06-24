import type { EmployeeStatus, LogStatus } from '../types';

export interface StatusMeta {
  color: string;
  label: string;
  /** Whether the status dot should pulse (active states only). */
  pulse: boolean;
}

/** Single source of truth: employee status → color / label / pulse. */
export const STATUS_META: Record<EmployeeStatus, StatusMeta> = {
  online:    { color: '#3fb950', label: 'Online',    pulse: false },
  working:   { color: '#3fb950', label: 'Working',   pulse: true  },
  building:  { color: '#d29922', label: 'Building',  pulse: true  },
  reviewing: { color: '#8b7cff', label: 'Reviewing', pulse: true  },
  idle:      { color: '#6e7681', label: 'Idle',      pulse: false },
};

export const isActive = (s: EmployeeStatus) => STATUS_META[s].pulse;

/** Execution-log status → color. */
export const LOG_COLOR: Record<LogStatus, string> = {
  Success: '#3fb950',
  Running: '#d29922',
  Failed:  '#f85149',
};
