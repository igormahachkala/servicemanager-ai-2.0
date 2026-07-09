/**
 * Tool Dispatcher — registered tools catalog (AI-COMPANY-111B).
 * V1: Cursor only. Add tools via registerToolDispatcherEntry().
 */

import { CURSOR_AUTOMATION_TOOL_ID } from '../cursorAutomation'
import { getToolDispatcherEndpointConfig } from './toolDispatcherConfig'
import {
  TOOL_DISPATCHER_TOOL_IDS,
  type ToolCapability,
  type ToolDispatcherRegistryEntry,
  type ToolDispatcherToolId,
  type ToolStatus,
} from './toolDispatcherTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function createCursorCapability(): ToolCapability {
  return {
    toolId: 'cursor',
    label: 'Cursor',
    description:
      'Cursor Automation — external coding executor. Tool, not a digital employee.',
    registryToolId: CURSOR_AUTOMATION_TOOL_ID,
    isEmployee: false,
    supportedActions: ['handoff', 'plan', 'status'],
    requiresOwnerApproval: true,
    endpoint: getToolDispatcherEndpointConfig('cursor'),
  }
}

const REGISTRY: Record<ToolDispatcherToolId, ToolDispatcherRegistryEntry> = {
  cursor: {
    capability: createCursorCapability(),
    status: 'available',
    statusReason: null,
    updatedAt: nowIso(),
  },
}

export function listToolDispatcherEntries(): ToolDispatcherRegistryEntry[] {
  return TOOL_DISPATCHER_TOOL_IDS.map((id) => REGISTRY[id])
}

export function getToolDispatcherEntry(
  toolId: ToolDispatcherToolId,
): ToolDispatcherRegistryEntry | null {
  return REGISTRY[toolId] ?? null
}

export function getToolCapability(toolId: ToolDispatcherToolId): ToolCapability | null {
  return REGISTRY[toolId]?.capability ?? null
}

export function getToolStatus(toolId: ToolDispatcherToolId): ToolStatus {
  return REGISTRY[toolId]?.status ?? 'offline'
}

export function setToolStatus(
  toolId: ToolDispatcherToolId,
  status: ToolStatus,
  statusReason: string | null = null,
): ToolDispatcherRegistryEntry | null {
  const entry = REGISTRY[toolId]
  if (!entry) return null

  entry.status = status
  entry.statusReason = statusReason
  entry.updatedAt = nowIso()
  return { ...entry, capability: { ...entry.capability, endpoint: { ...entry.capability.endpoint } } }
}

/** Register or replace a tool entry (for V2: Claude Code, Codex, …). */
export function registerToolDispatcherEntry(entry: ToolDispatcherRegistryEntry): void {
  REGISTRY[entry.capability.toolId] = entry
}
