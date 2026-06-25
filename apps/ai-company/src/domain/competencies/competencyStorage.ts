import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { createCompetency, type Competency } from './competency'
import { parseCertification, type Certification } from './certification'
import {
  createExperienceEvent,
  IMPACT_WEIGHT,
  parseExperienceEvent,
  type ExperienceEvent,
} from './experienceEvent'
import { parseLearningPath, type LearningPath } from './learningPath'
import { type Reputation } from './reputation'
import { createSkill, parseSkill, type Skill } from './skill'

export type EmployeeCompetencyRecord = {
  employeeId: string
  skills: Skill[]
  certifications: Certification[]
  experienceEvents: ExperienceEvent[]
  learningPath: LearningPath
  updatedAt: string
}

export type EmployeeCompetencySnapshot = EmployeeCompetencyRecord & {
  competencies: Competency[]
  reputation: Reputation
}

const STORAGE_KEY = 'ai-company-employee-competencies'

const SKILL_CATEGORY_MAP: Record<string, string> = {
  'Business Analysis': 'Analysis',
  Architecture: 'Engineering',
  Coding: 'Engineering',
  Testing: 'Quality',
  Research: 'Research',
  Documentation: 'Communication',
  Marketing: 'Growth',
  Finance: 'Operations',
  DevOps: 'Platform',
  'Product Management': 'Product',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRecord(value: unknown): EmployeeCompetencyRecord | null {
  if (!isRecord(value) || typeof value.employeeId !== 'string' || typeof value.updatedAt !== 'string') {
    return null
  }

  const skills = Array.isArray(value.skills)
    ? value.skills.map(parseSkill).filter((item): item is Skill => item !== null)
    : []

  const certifications = Array.isArray(value.certifications)
    ? value.certifications.map(parseCertification).filter((item): item is Certification => item !== null)
    : []

  const experienceEvents = Array.isArray(value.experienceEvents)
    ? value.experienceEvents.map(parseExperienceEvent).filter((item): item is ExperienceEvent => item !== null)
    : []

  return {
    employeeId: value.employeeId,
    skills,
    certifications,
    experienceEvents,
    learningPath: parseLearningPath(value.learningPath),
    updatedAt: value.updatedAt,
  }
}

function loadAllRecords(): Record<string, EmployeeCompetencyRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}

    const result: Record<string, EmployeeCompetencyRecord> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const record = parseRecord(value)
      if (record) result[key] = record
    }
    return result
  } catch {
    return {}
  }
}

function saveAllRecords(records: Record<string, EmployeeCompetencyRecord>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* noop */
  }
}

function saveRecord(record: EmployeeCompetencyRecord): EmployeeCompetencyRecord {
  const all = loadAllRecords()
  all[record.employeeId] = record
  saveAllRecords(all)
  return record
}

function seedSkillsForEmployee(employeeId: string): Skill[] {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  const roster = resolveEmployee(employeeId)

  const skillNames = custom?.skills ?? []
  if (skillNames.length === 0 && roster) {
    return [
      createSkill({
        name: roster.role,
        category: 'Core',
        level: 3,
        verified: roster.source === 'builtin',
      }),
    ]
  }

  return skillNames.map((name, index) =>
    createSkill({
      id: `skill-${employeeId}-${index}`,
      name,
      category: SKILL_CATEGORY_MAP[name] ?? 'General',
      level: custom?.status === 'active' ? 3 : 2,
      verified: index === 0,
    }),
  )
}

function seedCertifications(employeeId: string): Certification[] {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  if (!custom) return []

  const now = new Date().toISOString()
  return [
    {
      id: `cert-${employeeId}-foundation`,
      title: `${custom.role} Foundation`,
      issuer: 'AI Company Academy',
      status: 'completed',
      completedAt: custom.createdAt,
    },
    {
      id: `cert-${employeeId}-platform`,
      title: 'Platform Safety & Governance',
      issuer: 'AI Company Ops',
      status: custom.status === 'active' ? 'completed' : 'in_progress',
      completedAt: custom.status === 'active' ? now : undefined,
    },
  ]
}

function seedExperienceEvents(employeeId: string): ExperienceEvent[] {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  const roster = resolveEmployee(employeeId)
  const label = custom?.codename ?? roster?.codename ?? employeeId
  const createdAt = custom?.createdAt ?? new Date().toISOString()

  return [
    createExperienceEvent({
      id: `exp-${employeeId}-onboard`,
      type: 'training',
      description: `${label} onboarded into AI Company roster.`,
      impact: 'medium',
      createdAt,
    }),
    createExperienceEvent({
      id: `exp-${employeeId}-workspace`,
      type: 'workspace',
      workspaceId: undefined,
      description: 'Contributed to workspace planning and assignment reviews.',
      impact: 'medium',
      createdAt,
    }),
    createExperienceEvent({
      id: `exp-${employeeId}-report`,
      type: 'report',
      reportId: `report-${employeeId}-001`,
      description: 'Authored operational summary report for Owner review.',
      impact: 'high',
      createdAt,
    }),
  ]
}

function seedLearningPath(skills: Skill[]): LearningPath {
  const completed = skills.filter((skill) => skill.verified).map((skill) => skill.name)
  const planned = skills.filter((skill) => !skill.verified).map((skill) => skill.name)

  return {
    plannedSkills: planned.length > 0 ? planned : ['Architecture', 'Testing'],
    completedSkills: completed,
    recommendedSkills: ['Documentation', 'DevOps', 'Research'].filter(
      (item) => !completed.includes(item) && !planned.includes(item),
    ),
  }
}

function ensureRecord(employeeId: string): EmployeeCompetencyRecord {
  const existing = loadAllRecords()[employeeId]
  if (existing) return existing

  const skills = seedSkillsForEmployee(employeeId)
  const now = new Date().toISOString()
  const record: EmployeeCompetencyRecord = {
    employeeId,
    skills,
    certifications: seedCertifications(employeeId),
    experienceEvents: seedExperienceEvents(employeeId),
    learningPath: seedLearningPath(skills),
    updatedAt: now,
  }

  return saveRecord(record)
}

export function calculateCompetencies(record: EmployeeCompetencyRecord): Competency[] {
  const now = new Date().toISOString()
  const domains = new Map<string, { points: number; weight: number }>()

  for (const skill of record.skills) {
    const current = domains.get(skill.category) ?? { points: 0, weight: 0 }
    current.points += skill.level * 20 + (skill.verified ? 10 : 0)
    current.weight += 1
    domains.set(skill.category, current)
  }

  for (const event of record.experienceEvents) {
    const domain =
      event.type === 'report'
        ? 'Communication'
        : event.type === 'task'
          ? 'Delivery'
          : event.type === 'workspace'
            ? 'Collaboration'
            : event.type === 'training'
              ? 'Learning'
              : 'Operations'

    const current = domains.get(domain) ?? { points: 0, weight: 0 }
    current.points += IMPACT_WEIGHT[event.impact] * 8
    current.weight += 1
    domains.set(domain, current)
  }

  for (const cert of record.certifications) {
    if (cert.status !== 'completed') continue
    const current = domains.get('Credentials') ?? { points: 0, weight: 0 }
    current.points += 15
    current.weight += 1
    domains.set('Credentials', current)
  }

  return [...domains.entries()].map(([domain, value]) =>
    createCompetency(
      record.employeeId,
      domain,
      value.weight > 0 ? value.points / value.weight : 0,
      now,
    ),
  )
}

export function calculateReputation(record: EmployeeCompetencyRecord): Reputation {
  const now = new Date().toISOString()
  const taskEvents = record.experienceEvents.filter((event) => event.type === 'task')
  const reportEvents = record.experienceEvents.filter((event) => event.type === 'report')
  const reviewEvents = record.experienceEvents.filter((event) => event.type === 'review')

  const successfulTasks = taskEvents.filter((event) => event.impact === 'high').length
  const reportsQuality =
    reportEvents.length === 0
      ? 50
      : Math.min(
          100,
          reportEvents.reduce((sum, event) => sum + IMPACT_WEIGHT[event.impact] * 25, 0) /
            reportEvents.length,
        )

  const verifiedSkills = record.skills.filter((skill) => skill.verified).length
  const accuracy = Math.min(
    100,
    55 + verifiedSkills * 8 + record.certifications.filter((cert) => cert.status === 'completed').length * 5,
  )

  const reviews = reviewEvents.length + record.certifications.filter((cert) => cert.status === 'completed').length
  const productionApprovals = record.experienceEvents.filter(
    (event) => event.type === 'task' && event.impact === 'high',
  ).length

  const trustScore = Math.min(
    100,
    Math.round(accuracy * 0.35 + reportsQuality * 0.25 + successfulTasks * 6 + reviews * 4 + productionApprovals * 5),
  )

  return {
    accuracy,
    successfulTasks,
    reportsQuality: Math.round(reportsQuality),
    reviews,
    trustScore,
    productionApprovals,
    calculatedAt: now,
  }
}

export function getEmployeeCompetencySnapshot(employeeId: string): EmployeeCompetencySnapshot {
  const record = ensureRecord(employeeId)
  return {
    ...record,
    competencies: calculateCompetencies(record),
    reputation: calculateReputation(record),
  }
}

export function addExperienceEvent(
  employeeId: string,
  input: Omit<ExperienceEvent, 'id' | 'createdAt'>,
): EmployeeCompetencySnapshot {
  const record = ensureRecord(employeeId)
  const event = createExperienceEvent(input)
  const updated: EmployeeCompetencyRecord = {
    ...record,
    experienceEvents: [event, ...record.experienceEvents],
    updatedAt: event.createdAt,
  }
  saveRecord(updated)
  return getEmployeeCompetencySnapshot(employeeId)
}

export function refreshEmployeeCompetencies(employeeId: string): EmployeeCompetencySnapshot {
  const record = ensureRecord(employeeId)
  saveRecord({ ...record, updatedAt: new Date().toISOString() })
  return getEmployeeCompetencySnapshot(employeeId)
}

export function readCompetencyStorageKey(): string {
  return STORAGE_KEY
}

export type CompetencyStats = {
  skillCount: number
  verifiedSkills: number
  certificationCount: number
  experienceCount: number
  averageCompetency: number
  trustScore: number
}

export function buildCompetencyStats(snapshot: EmployeeCompetencySnapshot): CompetencyStats {
  const averageCompetency =
    snapshot.competencies.length === 0
      ? 0
      : Math.round(
          snapshot.competencies.reduce((sum, item) => sum + item.score, 0) /
            snapshot.competencies.length,
        )

  return {
    skillCount: snapshot.skills.length,
    verifiedSkills: snapshot.skills.filter((skill) => skill.verified).length,
    certificationCount: snapshot.certifications.length,
    experienceCount: snapshot.experienceEvents.length,
    averageCompetency,
    trustScore: snapshot.reputation.trustScore,
  }
}
