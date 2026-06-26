import type { ExecutionStatus } from '../execution/execution'

export const VISUAL_LAB_SESSION_ID = 'visual-lab-apl-login-001'

export type VisualLabActionKind =
  | 'test_started'
  | 'file_changed'
  | 'terminal_line'
  | 'cursor_move'
  | 'click'
  | 'highlight'
  | 'button_added'
  | 'screenshot'
  | 'build_passed'

export type VisualLabCursor = {
  x: number
  y: number
}

export type VisualLabHighlight = {
  id: string
  label: string
  top: number
  left: number
  width: number
  height: number
}

export type VisualLabClickRipple = {
  id: string
  x: number
  y: number
  target: string
}

export type VisualLabFileTab = {
  id: string
  path: string
  language: string
  content: string
  active?: boolean
}

export type VisualLabFileChange = {
  path: string
  summary: string
  addedLines: string[]
}

export type VisualLabTestStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'passed' | 'failed'
}

export type VisualLabScreenshot = {
  id: string
  label: string
  at: string
}

export type VisualLabTimelineEntry = {
  id: string
  at: string
  kind: VisualLabActionKind
  label: string
  detail?: string
}

export type VisualLabBrowserState = {
  url: string
  title: string
  showLoginButton: boolean
  loginButtonLabel: string
  cursor: VisualLabCursor | null
  highlights: VisualLabHighlight[]
  clicks: VisualLabClickRipple[]
}

export type VisualLabSessionContext = {
  sessionId: string
  employeeId: string
  employeeCodename: string
  employeeRole: string
  taskId: string
  taskTitle: string
  taskPriority: string
  executionId: string
  executionStatus: ExecutionStatus
  projectId: string
  projectTitle: string
  runtimeRunId: string | null
  handoffId: string | null
  reportId: string | null
}

export type VisualLabSession = {
  context: VisualLabSessionContext
  files: VisualLabFileTab[]
  timeline: VisualLabTimelineEntry[]
  terminalLines: string[]
  browser: VisualLabBrowserState
  testSteps: VisualLabTestStep[]
  screenshots: VisualLabScreenshot[]
  fileChanges: VisualLabFileChange[]
}

export type VisualLabPlaybackState = {
  activeIndex: number
  playing: boolean
  speed: 1 | 2 | 4
}

export type VisualLabDerivedState = {
  visibleTimeline: VisualLabTimelineEntry[]
  visibleTerminalLines: string[]
  browser: VisualLabBrowserState
  activeFileId: string
  testSteps: VisualLabTestStep[]
  screenshots: VisualLabScreenshot[]
  latestFileChange: VisualLabFileChange | null
}
