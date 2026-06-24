// ─────────────────────────────────────────────────────────────────────────────
// IT Company · Mission Control (Flow Workspace) — domain model
// Location: web/src/it-company/flow-workspace/types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeeStatus =
  | 'online'      // human owner, full access            → #3fb950
  | 'working'     // actively executing a task           → #3fb950 (pulsing)
  | 'building'    // CI / build in progress              → #d29922 (pulsing)
  | 'reviewing'   // reviewing / orchestrating           → #8b7cff (pulsing)
  | 'idle';       // standing by, no active task         → #6e7681

/** Geometric glyph rendered inside each node's icon tile. One per role. */
export type NodeShape =
  | 'ring' | 'diamond' | 'triangle' | 'square'
  | 'hex' | 'pentagon' | 'circle' | 'pill' | 'plus';

export type EmployeeKind = 'human' | 'ai';

/** V1 rollout: active agents run now; planned are visible but not executing. */
export type EmployeeLifecycle = 'active' | 'planned';

export interface ActivityItem {
  /** Relative timestamp label, e.g. "2m", "1h", "now". */
  t: string;
  text: string;
}

export interface Employee {
  id: string;
  kind: EmployeeKind;
  lifecycle: EmployeeLifecycle;
  /** Display role, e.g. "MAX Senior Developer". */
  role: string;
  /** Persona name shown as the node title, e.g. "MAX", "Atlas". */
  name: string;
  status: EmployeeStatus;
  /** Model label, e.g. "Claude Sonnet 4.5". */
  model: string;
  shape: NodeShape;
  /** Relative label for last execution, e.g. "1m ago", "—". */
  lastRun: string;
  /** Current task summary. */
  task: string;
  /** 0–100, or null when no measurable task. */
  progress: number | null;
  /** MCP integrations this employee can reach. */
  mcp: string[];
  /** id of the node this one reports to (org hierarchy), null for owner. */
  reportsTo: string | null;
  /** Recent activity timeline (inspector). */
  activity?: ActivityItem[];
}

/** Delegation edge. `badge` = in-flight item count rendered on the connector. */
export interface Connection {
  from: string;
  to: string;
  badge: number;
}

export type LogStatus = 'Success' | 'Running' | 'Failed';

export interface LogEntry {
  /** Absolute clock time, e.g. "18:42:07". */
  t: string;
  /** Node persona name, e.g. "MAX". */
  node: string;
  msg: string;
  status: LogStatus;
  /** Duration label, e.g. "1m12s", "—". */
  dur: string;
}

export interface FlowWorkspaceState {
  selectedId: string;   // inspector target, default "cto"
  leftOpen: boolean;    // default true
  rightOpen: boolean;   // default true
}
