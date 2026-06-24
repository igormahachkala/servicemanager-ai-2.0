import type { LogEntry } from '../types';
import { LOG_COLOR } from '../lib/status';
import { FONT_UI, FONT_MONO } from '../lib/tokens';
import { useI18n } from '../../i18n';

interface Props {
  entries: LogEntry[];
  summary: { success: number; running: number; failed: number };
}

/** Bottom execution log (col 2 / row 3). */
export function ExecutionLog({ entries, summary }: Props) {
  const { t } = useI18n();

  return (
    <footer
      style={{
        gridColumn: 2, gridRow: 3, borderTop: '1px solid rgba(255,255,255,.06)', background: '#0c0d10',
        display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 40, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#e6e8eb' }}>{t.flow.executionLog}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '1px 7px' }}>{t.flow.live}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 10.5, fontFamily: FONT_MONO, color: '#6b7280' }}>
          <span style={{ color: '#3fb950' }}>● {summary.success} {t.flow.logSuccess}</span>
          <span style={{ color: '#d29922' }}>● {summary.running} {t.flow.logRunning}</span>
          <span style={{ color: '#f85149' }}>● {summary.failed} {t.flow.logFailed}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 6px', fontFamily: FONT_MONO }}>
        {entries.map((entry, index) => {
          const color = LOG_COLOR[entry.status];
          const statusLabel = t.flow.logStatus[entry.status];
          return (
            <div key={index} className="itc-rowh" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px', borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: '#5b6068', width: 50, flex: 'none' }}>{entry.t}</span>
              <span style={{ width: 7, height: 7, borderRadius: entry.status === 'Failed' ? 2 : '50%', background: color, boxShadow: `0 0 7px ${color}`, flex: 'none', animation: entry.status === 'Running' ? 'itcPulse 1.4s ease-in-out infinite' : undefined }} />
              <span style={{ fontSize: 12, color: '#e6e8eb', width: 104, flex: 'none', fontFamily: FONT_UI, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.node}</span>
              <span style={{ fontSize: 11.5, color: '#9aa0aa', flex: 1, minWidth: 0, fontFamily: FONT_UI, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.msg}</span>
              <span style={{ fontSize: 11, color, width: 64, flex: 'none', textAlign: 'right', fontFamily: FONT_UI, fontWeight: 600 }}>{statusLabel}</span>
              <span style={{ fontSize: 11, color: '#6b7280', width: 54, flex: 'none', textAlign: 'right' }}>{entry.dur}</span>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
