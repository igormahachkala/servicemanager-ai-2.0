import type { EmployeeStatus } from '../types';
import { STATUS_META } from '../lib/status';

/** Status indicator dot; pulses for active states (working / building / reviewing). */
export function StatusDot({ status, size = 7 }: { status: EmployeeStatus; size?: number }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: m.color,
        boxShadow: `0 0 8px ${m.color}`,
        flex: 'none',
        animation: m.pulse ? 'itcPulse 1.8s ease-in-out infinite' : undefined,
      }}
    />
  );
}
