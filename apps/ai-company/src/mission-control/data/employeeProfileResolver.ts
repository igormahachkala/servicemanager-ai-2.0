import {
  defaultPermissions,
  getCustomEmployeeById,
  type CustomEmployee,
} from './customEmployees'
import { resolveCanonicalEmployeeId } from './employeeIdResolver'
import { agents } from './mock'
import type { Agent } from './types'

export function agentToProfileEmployee(agent: Agent): CustomEmployee {
  const status: CustomEmployee['status'] =
    agent.lifecycle === 'planned'
      ? 'planned'
      : agent.status === 'offline'
        ? 'disabled'
        : 'active'

  return {
    id: agent.id,
    name: agent.codename,
    codename: agent.codename,
    role: agent.role,
    status,
    primaryModel: agent.model,
    fallbackModels: [],
    tools: [...agent.tools],
    permissions: defaultPermissions(),
    description: `${agent.squad} · built-in digital employee`,
    skills: [],
    restrictions: [],
    systemPrompt: '',
    workflow: '',
    memoryScope: ['AI Company'],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

/** Resolves built-in agents and custom employees for profile/workspace UI. */
export function resolveProfileEmployee(rawId: string): CustomEmployee | null {
  const employeeId = resolveCanonicalEmployeeId(rawId)

  const custom = getCustomEmployeeById(employeeId)
  if (custom) return custom

  const agent = agents.find((item) => item.id === employeeId)
  if (agent) return agentToProfileEmployee(agent)

  return null
}
