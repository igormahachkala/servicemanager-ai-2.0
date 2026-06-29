export const EVENT_TYPES = [
  'employee.created',
  'employee.updated',
  'workspace.created',
  'workspace.assigned',
  'conversation.started',
  'chat.message',
  'memory.added',
  'knowledge.updated',
  'report.created',
  'approval.requested',
  'approval.granted',
  'approval.rejected',
  'tool.connected',
  'task.created',
  'task.completed',
  'runtime.started',
  'runtime.failed',
  'run.completed',
  'collaboration.started',
  'collaboration.message',
  'collaboration.consensus',
  'collaboration.completed',
  'handoff.created',
  'handoff.sent',
  'handoff.returned',
  'handoff.accepted',
  'handoff.rejected',
  'sprint.planned',
  'sprint.started',
  'sprint.completed',
  'workday.started',
  'workday.phase_changed',
  'workday.finished',
  'task_result.created',
  'task_result.ready',
  'task_result.approved',
  'task_result.changes_requested',
  'task_result.rejected',
  'task_result.archived',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const FUTURE_EVENT_TYPES = ['runtime.started', 'run.completed'] as const satisfies readonly EventType[]

export function isFutureEventType(type: EventType): boolean {
  return (FUTURE_EVENT_TYPES as readonly string[]).includes(type)
}
