/**
 * Employee Registry V2 — seed profiles (AI-COMPANY-112A).
 */

import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { OWNER_ID } from '../organization/organizationStorage'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import type { EmployeeProfile } from './employeeRegistryTypes'
import { EMPLOYEE_REGISTRY_VERSION } from './employeeRegistryTypes'

export const EMPLOYEE_REGISTRY_BUILTIN_IDS = {
  max: MAX_WORKER_EMPLOYEE_ID,
  builder: 'ag-builder',
  atlas: EMPLOYEE_ROUTE_IDS.atlas,
  sentinel: EMPLOYEE_ROUTE_IDS.sentinel,
} as const

const NOW = '2026-06-25T00:00:00.000Z'

function capability(id: string, label: string, enabled = true) {
  return { id, label, enabled }
}

function skill(id: string, label: string, level: EmployeeProfile['skills'][number]['level']) {
  return { id, label, level }
}

export const EMPLOYEE_REGISTRY_SEED: EmployeeProfile[] = [
  {
    version: EMPLOYEE_REGISTRY_VERSION,
    employeeId: EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
    displayName: 'MAX',
    title: 'AI Development Manager',
    department: 'Engineering',
    avatar: 'MX',
    status: 'busy',
    role: {
      id: 'ai-development-manager',
      title: 'AI Development Manager',
      department: 'Engineering',
    },
    skills: [
      skill('engineering-leadership', 'Engineering leadership', 'expert'),
      skill('code-review', 'Code review', 'expert'),
      skill('runtime-orchestration', 'Runtime orchestration', 'advanced'),
      skill('handoff-packaging', 'Handoff packaging', 'advanced'),
    ],
    capabilities: [
      capability('worker_loop', 'Worker Loop execution'),
      capability('work_queue', 'Work Queue management'),
      capability('runtime_live', 'Runtime Live'),
      capability('mobile_chat', 'Owner chat'),
      capability('cursor_handoff', 'Cursor handoff'),
      capability('daily_reports', 'Daily reports'),
    ],
    currentWorkload: 0,
    preferredTools: ['Cursor', 'Ollama', 'GitHub', 'Codex'],
    managerId: OWNER_ID,
    reportsTo: OWNER_ID,
    experienceProfile: {
      summary: 'Leads AI Company delivery cycles: task intake, Worker Loop, Runtime, and Owner reports.',
      yearsEquivalent: 8,
      focusAreas: ['Mobile UX', 'Work Queue', 'Runtime integration', 'Owner workflows'],
    },
    availability: 'active',
    rosterSlotId: 'max',
    updatedAt: NOW,
  },
  {
    version: EMPLOYEE_REGISTRY_VERSION,
    employeeId: EMPLOYEE_REGISTRY_BUILTIN_IDS.builder,
    displayName: 'Builder',
    title: 'Software Engineer',
    department: 'Engineering',
    avatar: 'BU',
    status: 'available',
    role: {
      id: 'software-engineer',
      title: 'Software Engineer',
      department: 'Engineering',
    },
    skills: [
      skill('typescript', 'TypeScript', 'advanced'),
      skill('react', 'React', 'advanced'),
      skill('api-design', 'API design', 'intermediate'),
      skill('testing', 'Unit testing', 'intermediate'),
    ],
    capabilities: [
      capability('work_queue', 'Work Queue tasks', true),
      capability('mobile_chat', 'Owner chat', true),
      capability('operating_day', 'Operating Day', true),
      capability('daily_journal', 'Daily Journal', true),
      capability('daily_reports', 'Daily reports', true),
      capability('conversation_memory', 'Conversation memory', true),
    ],
    currentWorkload: 0,
    preferredTools: ['Cursor', 'GitHub', 'Vitest'],
    managerId: EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
    reportsTo: EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
    experienceProfile: {
      summary: 'Implements product features and stabilizes MVP flows under MAX direction.',
      yearsEquivalent: 4,
      focusAreas: ['Frontend', 'API integration', 'Developer experience'],
    },
    availability: 'active',
    rosterSlotId: 'builder',
    updatedAt: NOW,
  },
  {
    version: EMPLOYEE_REGISTRY_VERSION,
    employeeId: EMPLOYEE_REGISTRY_BUILTIN_IDS.atlas,
    displayName: 'Atlas',
    title: 'Solution Architect',
    department: 'Architecture',
    avatar: 'AT',
    status: 'available',
    role: {
      id: 'solution-architect',
      title: 'Solution Architect',
      department: 'Architecture',
    },
    skills: [
      skill('system-design', 'System design', 'expert'),
      skill('architecture-review', 'Architecture review', 'expert'),
      skill('risk-assessment', 'Risk assessment', 'advanced'),
      skill('documentation', 'Technical documentation', 'advanced'),
    ],
    capabilities: [
      capability('architecture_review', 'Architecture review', true),
      capability('delivery_planning', 'Delivery planning', true),
      capability('decision_framing', 'Owner decision framing', true),
      capability('runtime_live', 'Runtime advisory', false),
    ],
    currentWorkload: 0,
    preferredTools: ['GitHub', 'Cursor', 'PostgreSQL'],
    managerId: OWNER_ID,
    reportsTo: OWNER_ID,
    experienceProfile: {
      summary: 'Owns architecture, invariants, and trade-offs across AI Company and delivery projects.',
      yearsEquivalent: 10,
      focusAreas: ['Multi-tenant design', 'Platform boundaries', 'Sprint planning'],
    },
    availability: 'limited',
    rosterSlotId: 'atlas',
    updatedAt: NOW,
  },
  {
    version: EMPLOYEE_REGISTRY_VERSION,
    employeeId: EMPLOYEE_REGISTRY_BUILTIN_IDS.sentinel,
    displayName: 'Sentinel',
    title: 'QA & Reliability Engineer',
    department: 'Quality',
    avatar: 'SN',
    status: 'planned',
    role: {
      id: 'qa-reliability',
      title: 'QA & Reliability Engineer',
      department: 'Quality',
    },
    skills: [
      skill('qa-engineering', 'QA engineering', 'expert'),
      skill('acceptance-testing', 'Acceptance testing', 'advanced'),
      skill('reliability', 'Reliability engineering', 'advanced'),
      skill('demo-readiness', 'Demo readiness', 'advanced'),
    ],
    capabilities: [
      capability('qa_checklists', 'QA checklists', true),
      capability('acceptance_criteria', 'Acceptance criteria', true),
      capability('regression_risk', 'Regression risk review', true),
      capability('worker_loop', 'Worker Loop execution', false),
    ],
    currentWorkload: 0,
    preferredTools: ['Playwright', 'GitHub', 'Cursor'],
    managerId: EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
    reportsTo: EMPLOYEE_REGISTRY_BUILTIN_IDS.max,
    experienceProfile: {
      summary: 'Guards delivery quality with reproducible scenarios, gates, and demo readiness reviews.',
      yearsEquivalent: 6,
      focusAreas: ['Acceptance testing', 'Reliability', 'Owner demo flows'],
    },
    availability: 'placeholder',
    rosterSlotId: 'sentinel',
    updatedAt: NOW,
  },
]

export function getSeedEmployeeProfile(employeeId: string): EmployeeProfile | null {
  return EMPLOYEE_REGISTRY_SEED.find((item) => item.employeeId === employeeId) ?? null
}
