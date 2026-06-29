import type { Messages } from './en'

type StringMap = Record<string, string>

function pick(map: StringMap, key: string): string {
  return map[key] ?? key
}

export function executionStatusLabel(t: Messages, status: string): string {
  return pick(t.executionEngine.statuses as StringMap, status)
}

export function taskStatusLabel(t: Messages, status: string): string {
  return pick(t.projects.taskStatus as StringMap, status)
}

export function taskPriorityLabel(t: Messages, priority: string): string {
  return pick(t.projects.taskPriority as StringMap, priority)
}

export function approvalPriorityLabel(t: Messages, priority: string): string {
  return pick(t.approvalEngine.priorities as StringMap, priority)
}

export function handoffPriorityLabel(t: Messages, priority: string): string {
  return pick((t.handoffEngine.priorities ?? t.approvalEngine.priorities) as StringMap, priority)
}

export function runtimeStateLabel(t: Messages, status: string): string {
  return pick(t.runtimeOrchestrator.states as StringMap, status)
}

export function reportTypeLabel(t: Messages, type: string): string {
  return pick(t.reports.types as StringMap, type)
}

export function presenceStatusLabel(t: Messages, status: string): string {
  return pick(t.presence.status as StringMap, status)
}

export function demoChecklistStatusLabel(t: Messages, status: string): string {
  return pick(t.photoLabKickoff.checklistStatus as StringMap, status)
}

export function ownerDecisionKindLabel(t: Messages, kind: string): string {
  return pick(t.photoLabControlRoom.decisionKinds as StringMap, kind)
}

export function milestoneStatusLabel(t: Messages, status: string): string {
  return pick(t.projects.milestoneStatus as StringMap, status)
}

export function controlRoomRiskLevelLabel(t: Messages, level: string): string {
  return pick(t.photoLabControlRoom.riskLevels as StringMap, level)
}

export function controlRoomRiskStatusLabel(t: Messages, status: string): string {
  return pick(t.photoLabControlRoom.riskStatuses as StringMap, status)
}

export function handoffStatusLabel(t: Messages, status: string): string {
  return pick(t.handoffEngine.statuses as StringMap, status)
}

export function notificationCategoryLabel(t: Messages, type: string): string {
  return pick(t.notificationEngine.categories as StringMap, type)
}

export function eventTypeLabel(t: Messages, type: string): string {
  return pick(t.eventEngine.types as StringMap, type)
}

export function canvasNodeKindLabel(t: Messages, kind: string): string {
  return pick(t.canvasEngine.nodeKinds as StringMap, kind)
}

export function providerHealthLabel(t: Messages, status: string): string {
  return pick(t.commandCenter.providerHealth as StringMap, status)
}

export function pipelineStepStatusLabel(t: Messages, status: string): string {
  return pick(t.runtimeOrchestrator.pipelineStepStatuses as StringMap, status)
}

export function feedSeverityLabel(t: Messages, severity: string): string {
  return pick(t.feedSeverity as StringMap, severity)
}

export function toolExecutionStatusLabel(t: Messages, status: string): string {
  return pick(t.toolExecutionEngine.statuses as StringMap, status)
}
