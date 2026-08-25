import type { EmployeeProfile } from '../employeeRegistry/employeeRegistryTypes'

/**
 * A2A (Agent2Agent, Linux Foundation) interop — Agent Card.
 *
 * The Agent Card is A2A's unit of discovery: it advertises what an agent is and can
 * do so OTHER agents/platforms can address it. Mapping each Digital Employee to an
 * Agent Card makes the roster interoperable over the emerging agent-to-agent standard
 * (horizontal), complementing MCP (agent-to-tools, vertical). Pure and framework-free.
 */

export type A2AAgentSkill = {
  id: string
  name: string
  description: string
  tags: string[]
  examples?: string[]
}

export type A2AAgentCapabilities = {
  streaming: boolean
  pushNotifications: boolean
  stateTransitionHistory: boolean
}

export type A2AAgentProvider = {
  organization: string
  url: string
}

export type A2AAgentCard = {
  name: string
  description: string
  url: string
  version: string
  provider: A2AAgentProvider
  capabilities: A2AAgentCapabilities
  defaultInputModes: string[]
  defaultOutputModes: string[]
  skills: A2AAgentSkill[]
}

export type EmployeeToAgentCardOptions = {
  /** Public base URL of the AI Company platform, e.g. https://app.example.com */
  baseUrl: string
  provider?: A2AAgentProvider
  /** Agent Card version string. Default '1.0.0'. */
  cardVersion?: string
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter((v) => v && v.trim().length > 0))]
}

/** Deterministic per-employee A2A endpoint. */
export function agentEndpointUrl(baseUrl: string, employeeId: string): string {
  return `${trimSlash(baseUrl)}/a2a/agents/${employeeId}`
}

/** A2A well-known discovery path for an employee agent. */
export function agentCardWellKnownPath(employeeId: string): string {
  return `/a2a/agents/${employeeId}/.well-known/agent-card.json`
}

/** Map one Digital Employee profile to an A2A Agent Card. */
export function employeeToAgentCard(
  employee: EmployeeProfile,
  options: EmployeeToAgentCardOptions,
): A2AAgentCard {
  const baseUrl = trimSlash(options.baseUrl)
  const skillTags = (extra: string[]) => uniq([employee.role.title, employee.department, ...extra])

  const skills: A2AAgentSkill[] = [
    ...employee.skills.map((s) => ({
      id: s.id,
      name: s.label,
      description: `${s.label} — ${s.level}`,
      tags: skillTags([s.level]),
      examples: employee.experienceProfile.focusAreas.slice(0, 3),
    })),
    ...employee.capabilities
      .filter((c) => c.enabled)
      .map((c) => ({
        id: `capability:${c.id}`,
        name: c.label,
        description: `Platform capability: ${c.label}`,
        tags: skillTags(['capability']),
      })),
  ]

  return {
    name: employee.displayName,
    description: employee.experienceProfile.summary || employee.title,
    url: agentEndpointUrl(baseUrl, employee.employeeId),
    version: options.cardVersion ?? '1.0.0',
    provider: options.provider ?? { organization: 'AI Company', url: baseUrl },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills,
  }
}

/** Map a roster to A2A Agent Cards. */
export function employeesToAgentCards(
  employees: EmployeeProfile[],
  options: EmployeeToAgentCardOptions,
): A2AAgentCard[] {
  return employees.map((e) => employeeToAgentCard(e, options))
}
