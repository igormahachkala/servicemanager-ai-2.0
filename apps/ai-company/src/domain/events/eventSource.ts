export const EVENT_SOURCE_TYPES = [
  'employee',
  'workspace',
  'conversation',
  'chat',
  'memory',
  'knowledge',
  'report',
  'approval',
  'tool',
  'task',
  'runtime',
  'run',
  'collaboration',
  'handoff',
  'system',
  'owner',
] as const

export type EventSourceType = (typeof EVENT_SOURCE_TYPES)[number]
