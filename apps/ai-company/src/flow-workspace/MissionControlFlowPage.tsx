import { useMemo, useState } from 'react';
import { FONT_UI } from './lib/tokens';
import { EMPLOYEES, CONNECTIONS, EXECUTION_LOG, LOG_SUMMARY, ACTIVE_EMPLOYEES } from './data/missionControl.mock';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { NodeRail } from './components/NodeRail';
import { FlowCanvas } from './components/FlowCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { ExecutionLog } from './components/ExecutionLog';

/**
 * IT Company — Mission Control (Flow Workspace).
 *
 * Self-contained screen (CSS-in-TS, no global stylesheet, no UI-kit changes).
 * Designed at 1440×900; fills its container. Mount this as a standalone page
 * inside web/src/it-company/** and wire the route in a SEPARATE task (gated by
 * canViewITCompany / PLATFORM_ADMIN) after review.
 *
 * Data comes from ./data/missionControl.mock — no backend/API here.
 */
export function MissionControlFlowPage() {
  const [selectedId, setSelectedId] = useState('cto');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const selected = useMemo(
    () => EMPLOYEES.find((e) => e.id === selectedId) ?? EMPLOYEES[1],
    [selectedId],
  );

  const gridTemplateColumns = `${leftOpen ? '62px' : '0px'} minmax(0,1fr) ${rightOpen ? '344px' : '0px'}`;

  return (
    <div
      className="itc-flow"
      style={{
        height: '100%', display: 'grid',
        gridTemplateColumns,
        gridTemplateRows: '54px minmax(0,1fr) 204px',
        background: '#0a0a0c', color: '#e6e8eb', fontFamily: FONT_UI, fontSize: 13, overflow: 'hidden',
      }}
    >
      <ScopedStyle />

      <WorkspaceHeader
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        nodeCount={EMPLOYEES.length}
        runningCount={ACTIVE_EMPLOYEES.length}
      />

      {/* Collapsible panels are conditionally rendered (not display:none) so the
          0px grid track truly collapses and the canvas expands to fill it. */}
      {leftOpen && (
        <NodeRail employees={EMPLOYEES} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <FlowCanvas
        employees={EMPLOYEES}
        connections={CONNECTIONS}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {rightOpen && (
        <InspectorPanel employee={selected} onCollapse={() => setRightOpen(false)} />
      )}

      <ExecutionLog entries={EXECUTION_LOG} summary={LOG_SUMMARY} />
    </div>
  );
}

export default MissionControlFlowPage;

/**
 * Scoped keyframes + hover rules. This is the only CSS-as-string in the screen;
 * everything else is inline style objects. All selectors are namespaced under
 * `.itc-flow` so nothing leaks into the global app.
 */
function ScopedStyle() {
  return (
    <style>{`
      @keyframes itcPulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
      @keyframes itcDash  { to { stroke-dashoffset: -16 } }
      @keyframes itcBlink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
      @keyframes itcGlow {
        0%,100% { box-shadow: 0 0 0 1px rgba(139,124,255,.6), 0 0 24px -6px rgba(139,124,255,.6) }
        50%     { box-shadow: 0 0 0 1px rgba(139,124,255,.95), 0 0 34px 0 rgba(139,124,255,.8) }
      }
      .itc-flow .itc-node:hover { transform: translateY(-2px); border-color: rgba(139,124,255,.55) !important; }
      .itc-flow .itc-rowh:hover { background: rgba(255,255,255,.03); }
      .itc-flow .itc-btn:hover  { border-color: rgba(255,255,255,.24); }
      .itc-flow ::-webkit-scrollbar { width: 9px; height: 9px; }
      .itc-flow ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 6px; }
      .itc-flow ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.18); }
      .itc-flow ::-webkit-scrollbar-track { background: transparent; }
    `}</style>
  );
}
