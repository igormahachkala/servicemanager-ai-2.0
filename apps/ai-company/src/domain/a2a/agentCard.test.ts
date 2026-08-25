import assert from 'node:assert/strict'
import test from 'node:test'
import type { EmployeeProfile } from '../employeeRegistry/employeeRegistryTypes'
import { employeeToAgentCard, agentCardWellKnownPath, employeesToAgentCards } from './agentCard'

function emp(o: Record<string, unknown>): EmployeeProfile {
  return {
    version: 'v1', employeeId: 'ag-max', displayName: 'MAX', title: 'AI Development Manager',
    department: 'Engineering', avatar: 'MX', status: 'busy',
    role: { id: 'ai-development-manager', title: 'AI Development Manager', department: 'Engineering' },
    skills: [{ id: 'code-review', label: 'Code review', level: 'expert' }],
    capabilities: [
      { id: 'worker_loop', label: 'Worker Loop execution', enabled: true },
      { id: 'runtime_live', label: 'Runtime Live', enabled: false },
    ],
    currentWorkload: 0, preferredTools: ['Cursor'], managerId: null, reportsTo: null,
    experienceProfile: { summary: 'Leads AI Company delivery cycles.', yearsEquivalent: 8, focusAreas: ['Work Queue', 'Runtime'] },
    availability: 'active', rosterSlotId: 'max', updatedAt: '2026-06-25T00:00:00.000Z', ...o,
  } as unknown as EmployeeProfile
}

test('maps core identity fields', () => {
  const card = employeeToAgentCard(emp({}), { baseUrl: 'https://app.example.com/' })
  assert.equal(card.name, 'MAX')
  assert.equal(card.description, 'Leads AI Company delivery cycles.')
  assert.equal(card.url, 'https://app.example.com/a2a/agents/ag-max')
  assert.equal(card.provider.organization, 'AI Company')
  assert.deepEqual(card.defaultInputModes, ['text/plain', 'application/json'])
})

test('skills include employee skills + only ENABLED capabilities', () => {
  const card = employeeToAgentCard(emp({}), { baseUrl: 'https://x.io' })
  const ids = card.skills.map((s) => s.id)
  assert.ok(ids.includes('code-review'))
  assert.ok(ids.includes('capability:worker_loop'))
  assert.ok(!ids.includes('capability:runtime_live')) // disabled excluded
  const cr = card.skills.find((s) => s.id === 'code-review')!
  assert.ok(cr.tags.includes('expert'))
  assert.ok(cr.tags.includes('Engineering'))
})

test('well-known path + roster mapping', () => {
  assert.equal(agentCardWellKnownPath('ag-max'), '/a2a/agents/ag-max/.well-known/agent-card.json')
  const cards = employeesToAgentCards([emp({}), emp({ employeeId: 'ag-atlas', displayName: 'Atlas' })], { baseUrl: 'https://x.io' })
  assert.equal(cards.length, 2)
  assert.equal(cards[1].url, 'https://x.io/a2a/agents/ag-atlas')
})

test('falls back to title when summary is empty, and custom provider/version', () => {
  const card = employeeToAgentCard(
    emp({ experienceProfile: { summary: '', yearsEquivalent: null, focusAreas: [] } }),
    { baseUrl: 'https://x.io', provider: { organization: 'Acme', url: 'https://acme.io' }, cardVersion: '2.1.0' },
  )
  assert.equal(card.description, 'AI Development Manager')
  assert.equal(card.provider.organization, 'Acme')
  assert.equal(card.version, '2.1.0')
})
