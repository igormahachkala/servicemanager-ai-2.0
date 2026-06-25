import { addExperienceEvent, getEmployeeCompetencySnapshot } from '../competencies/competencyStorage'
import { AI_PHOTO_LAB_PROJECT_ID } from '../projects/aiPhotoLabIds'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { createLearningGoal, parseLearningGoal, type LearningGoal, type LearningGoalStatus } from './learningGoal'
import {
  createLearningRecommendation,
  parseLearningRecommendation,
  type LearningRecommendation,
} from './learningRecommendation'
import {
  createLearningSession,
  parseLearningSession,
  type LearningSession,
} from './learningSession'

export type SkillProgressPoint = {
  skillName: string
  percent: number
  recordedAt: string
}

export type EmployeeLearningRecord = {
  employeeId: string
  sessions: LearningSession[]
  goals: LearningGoal[]
  recommendations: LearningRecommendation[]
  skillProgress: Record<string, number>
  skillProgressHistory: SkillProgressPoint[]
  totalExperience: number
  updatedAt: string
}

export type EmployeeLearningSnapshot = EmployeeLearningRecord & {
  activeGoals: LearningGoal[]
  pendingRecommendations: LearningRecommendation[]
  recentSessions: LearningSession[]
  certificatesEarned: number
}

export type LearningStats = {
  totalSessions: number
  completedSessions: number
  activeGoals: number
  pendingRecommendations: number
  totalExperience: number
  skillsTracked: number
  averageProgress: number
}

const STORAGE_KEY = 'ai-company-learning'
export const CHANGE_EVENT = 'ai-company-learning-change'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function parseSkillProgress(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number') result[key] = clampPercent(raw)
  }
  return result
}

function parseSkillProgressHistory(value: unknown): SkillProgressPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!isRecord(item)) return null
      if (typeof item.skillName !== 'string' || typeof item.recordedAt !== 'string') return null
      return {
        skillName: item.skillName,
        percent: clampPercent(typeof item.percent === 'number' ? item.percent : 0),
        recordedAt: item.recordedAt,
      }
    })
    .filter((item): item is SkillProgressPoint => item !== null)
}

function parseRecord(value: unknown): EmployeeLearningRecord | null {
  if (!isRecord(value) || typeof value.employeeId !== 'string' || typeof value.updatedAt !== 'string') {
    return null
  }

  const sessions = Array.isArray(value.sessions)
    ? value.sessions.map(parseLearningSession).filter((item): item is LearningSession => item !== null)
    : []

  const goals = Array.isArray(value.goals)
    ? value.goals.map(parseLearningGoal).filter((item): item is LearningGoal => item !== null)
    : []

  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations
        .map(parseLearningRecommendation)
        .filter((item): item is LearningRecommendation => item !== null)
    : []

  return {
    employeeId: value.employeeId,
    sessions,
    goals,
    recommendations,
    skillProgress: parseSkillProgress(value.skillProgress),
    skillProgressHistory: parseSkillProgressHistory(value.skillProgressHistory),
    totalExperience: typeof value.totalExperience === 'number' ? value.totalExperience : 0,
    updatedAt: value.updatedAt,
  }
}

function loadAllRecords(): Record<string, EmployeeLearningRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}

    const result: Record<string, EmployeeLearningRecord> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const record = parseRecord(value)
      if (record) result[key] = record
    }
    return result
  } catch {
    return {}
  }
}

function saveAllRecords(records: Record<string, EmployeeLearningRecord>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    /* noop */
  }
}

function saveRecord(record: EmployeeLearningRecord): EmployeeLearningRecord {
  const all = loadAllRecords()
  all[record.employeeId] = record
  saveAllRecords(all)
  return record
}

function recordSkillProgressPoint(
  record: EmployeeLearningRecord,
  skillName: string,
  percent: number,
): SkillProgressPoint[] {
  const history = [...record.skillProgressHistory]
  const last = [...history].reverse().find((item) => item.skillName === skillName)
  if (!last || Math.abs(last.percent - percent) >= 1) {
    history.unshift({
      skillName,
      percent: clampPercent(percent),
      recordedAt: new Date().toISOString(),
    })
  }
  return history.slice(0, 120)
}

function applySkillGain(
  record: EmployeeLearningRecord,
  skillName: string,
  gain: number,
): EmployeeLearningRecord {
  const current = record.skillProgress[skillName] ?? inferSkillPercent(record.employeeId, skillName)
  const next = clampPercent(current + gain)
  const skillProgress = { ...record.skillProgress, [skillName]: next }
  const skillProgressHistory = recordSkillProgressPoint(
    { ...record, skillProgress },
    skillName,
    next,
  )

  const goals = record.goals.map((goal) => {
    if (goal.skillName !== skillName || goal.status !== 'active') return goal
    const updatedCurrent = clampPercent(Math.max(goal.currentPercent, next))
    const status: LearningGoalStatus =
      updatedCurrent >= goal.targetPercent ? 'completed' : goal.status
    return {
      ...goal,
      currentPercent: updatedCurrent,
      status,
      updatedAt: new Date().toISOString(),
    }
  })

  return {
    ...record,
    skillProgress,
    skillProgressHistory,
    goals,
    totalExperience: record.totalExperience + gain,
    updatedAt: new Date().toISOString(),
  }
}

function inferSkillPercent(employeeId: string, skillName: string): number {
  const snapshot = getEmployeeCompetencySnapshot(employeeId)
  const skill = snapshot.skills.find((item) => item.name === skillName)
  if (skill) return clampPercent(skill.level * 20)
  const domain = snapshot.competencies.find((item) => item.domain === skillName)
  if (domain) return domain.score
  return 40
}

function seedMaxLearning(employeeId: string, now: string): EmployeeLearningRecord {
  const sessions: LearningSession[] = [
    createLearningSession({
      id: `ls-${employeeId}-platform-safety`,
      employeeId,
      skillName: 'Coding',
      type: 'certification',
      title: 'Platform Safety & Governance',
      description: 'Completed foundational platform safety certification.',
      status: 'completed',
      progressPercent: 100,
      experienceGain: 4,
      completedAt: now,
      createdAt: now,
    }),
    createLearningSession({
      id: `ls-${employeeId}-react-review`,
      employeeId,
      skillName: 'React',
      type: 'review',
      title: 'React patterns review',
      description: 'Reviewing component architecture and state patterns for AI Company V1.',
      status: 'in_progress',
      progressPercent: 60,
      experienceGain: 3,
      startedAt: now,
      createdAt: now,
    }),
    createLearningSession({
      id: `ls-${employeeId}-photo-lab-study`,
      employeeId,
      skillName: 'React',
      type: 'study',
      title: 'Study Project AI Photo Lab',
      description: 'Explore frontend patterns in the AI Photo Lab delivery workspace.',
      status: 'planned',
      progressPercent: 0,
      experienceGain: 5,
      relatedProjectId: AI_PHOTO_LAB_PROJECT_ID,
      createdAt: now,
    }),
  ]

  const goals: LearningGoal[] = [
    createLearningGoal({
      id: `lg-${employeeId}-react`,
      employeeId,
      skillName: 'React',
      currentPercent: 84,
      targetPercent: 95,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }),
    createLearningGoal({
      id: `lg-${employeeId}-architecture`,
      employeeId,
      skillName: 'Architecture',
      currentPercent: 72,
      targetPercent: 88,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }),
  ]

  const recommendations: LearningRecommendation[] = [
    createLearningRecommendation({
      id: `lr-${employeeId}-photo-lab`,
      employeeId,
      skillName: 'React',
      kind: 'project',
      title: 'Study Project AI Photo Lab',
      summary: 'Hands-on React patterns in the active Photo Lab delivery project.',
      priority: 'high',
      href: `/ops/projects/${AI_PHOTO_LAB_PROJECT_ID}`,
      createdAt: now,
    }),
    createLearningRecommendation({
      id: `lr-${employeeId}-adr`,
      employeeId,
      skillName: 'Architecture',
      kind: 'knowledge',
      title: 'Review Architecture ADR',
      summary: 'Read platform ADR-001 and align implementation decisions.',
      priority: 'medium',
      href: '/ops/knowledge',
      createdAt: now,
    }),
    createLearningRecommendation({
      id: `lr-${employeeId}-runtime-report`,
      employeeId,
      skillName: 'React',
      kind: 'report',
      title: 'Complete Runtime Report',
      summary: 'Finish a runtime session and publish the generated operational report.',
      priority: 'high',
      href: '/ops/reports',
      createdAt: now,
    }),
  ]

  const skillProgress: Record<string, number> = {
    React: 84,
    Architecture: 72,
    Coding: 80,
  }

  const skillProgressHistory: SkillProgressPoint[] = [
    { skillName: 'React', percent: 72, recordedAt: '2026-06-01T10:00:00.000Z' },
    { skillName: 'React', percent: 78, recordedAt: '2026-06-10T14:30:00.000Z' },
    { skillName: 'React', percent: 84, recordedAt: '2026-06-20T09:15:00.000Z' },
    { skillName: 'Architecture', percent: 65, recordedAt: '2026-06-05T11:00:00.000Z' },
    { skillName: 'Architecture', percent: 72, recordedAt: '2026-06-18T16:45:00.000Z' },
  ]

  return {
    employeeId,
    sessions,
    goals,
    recommendations,
    skillProgress,
    skillProgressHistory,
    totalExperience: 24,
    updatedAt: now,
  }
}

function seedGenericLearning(employeeId: string, now: string): EmployeeLearningRecord {
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  const roster = resolveEmployee(employeeId)
  const label = custom?.codename ?? roster?.codename ?? employeeId
  const primarySkill = custom?.skills[0] ?? roster?.role ?? 'General'

  const current = inferSkillPercent(employeeId, primarySkill)
  const target = clampPercent(current + 12)

  const goals: LearningGoal[] = [
    createLearningGoal({
      employeeId,
      skillName: primarySkill,
      currentPercent: current,
      targetPercent: target,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }),
  ]

  const recommendations: LearningRecommendation[] = [
    createLearningRecommendation({
      employeeId,
      skillName: primarySkill,
      kind: 'study',
      title: `Practice ${primarySkill}`,
      summary: `${label} should close the gap from ${current}% to ${target}% through guided study.`,
      priority: 'medium',
      href: `/ops/employees/${employeeId}/learning`,
      createdAt: now,
    }),
    createLearningRecommendation({
      employeeId,
      skillName: primarySkill,
      kind: 'runtime',
      title: 'Complete a Runtime session',
      summary: 'Apply skills in a mock runtime run and capture the generated report.',
      priority: 'medium',
      href: `/ops/employees/${employeeId}/runtime`,
      createdAt: now,
    }),
  ]

  const skillProgress: Record<string, number> = { [primarySkill]: current }

  return {
    employeeId,
    sessions: [
      createLearningSession({
        employeeId,
        skillName: primarySkill,
        type: 'study',
        title: `${label} onboarding study`,
        description: `Initial learning path for ${primarySkill}.`,
        status: 'completed',
        progressPercent: 100,
        experienceGain: 3,
        completedAt: now,
        createdAt: now,
      }),
    ],
    goals,
    recommendations,
    skillProgress,
    skillProgressHistory: [{ skillName: primarySkill, percent: current, recordedAt: now }],
    totalExperience: 3,
    updatedAt: now,
  }
}

function ensureRecord(employeeId: string): EmployeeLearningRecord {
  const existing = loadAllRecords()[employeeId]
  if (existing) return existing

  const now = new Date().toISOString()
  const record =
    employeeId === 'ag-max' ? seedMaxLearning(employeeId, now) : seedGenericLearning(employeeId, now)
  return saveRecord(record)
}

function toSnapshot(record: EmployeeLearningRecord): EmployeeLearningSnapshot {
  const competency = getEmployeeCompetencySnapshot(record.employeeId)
  return {
    ...record,
    activeGoals: record.goals.filter((goal) => goal.status === 'active'),
    pendingRecommendations: record.recommendations.filter((item) => !item.dismissed),
    recentSessions: [...record.sessions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12),
    certificatesEarned: competency.certifications.filter((cert) => cert.status === 'completed').length,
  }
}

export function getEmployeeLearningSnapshot(employeeId: string): EmployeeLearningSnapshot {
  return toSnapshot(ensureRecord(employeeId))
}

export function readLearningStorageKey(): string {
  return STORAGE_KEY
}

export function buildLearningStats(snapshot: EmployeeLearningSnapshot): LearningStats {
  const progressValues = Object.values(snapshot.skillProgress)
  const averageProgress =
    progressValues.length === 0
      ? 0
      : Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)

  return {
    totalSessions: snapshot.sessions.length,
    completedSessions: snapshot.sessions.filter((item) => item.status === 'completed').length,
    activeGoals: snapshot.activeGoals.length,
    pendingRecommendations: snapshot.pendingRecommendations.length,
    totalExperience: snapshot.totalExperience,
    skillsTracked: progressValues.length,
    averageProgress,
  }
}

export function getSkillProgressForChart(
  snapshot: EmployeeLearningSnapshot,
  skillName?: string,
): SkillProgressPoint[] {
  const history = snapshot.skillProgressHistory
  if (!skillName) return history
  return history.filter((item) => item.skillName === skillName)
}

export function completeLearningSession(
  employeeId: string,
  sessionId: string,
): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const session = record.sessions.find((item) => item.id === sessionId)
  if (!session || session.status === 'completed') return toSnapshot(record)

  const now = new Date().toISOString()
  const sessions = record.sessions.map((item) =>
    item.id === sessionId
      ? { ...item, status: 'completed' as const, progressPercent: 100, completedAt: now }
      : item,
  )

  let updated: EmployeeLearningRecord = { ...record, sessions, updatedAt: now }
  updated = applySkillGain(updated, session.skillName, session.experienceGain)

  addExperienceEvent(employeeId, {
    type: 'training',
    description: `Completed learning session: ${session.title}`,
    impact: session.experienceGain >= 4 ? 'high' : 'medium',
    taskId: session.relatedRunId,
    reportId: session.relatedReportId,
  })

  return toSnapshot(saveRecord(updated))
}

export function startLearningSession(
  employeeId: string,
  sessionId: string,
): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const now = new Date().toISOString()
  const sessions = record.sessions.map((item) =>
    item.id === sessionId && item.status === 'planned'
      ? { ...item, status: 'in_progress' as const, startedAt: now, progressPercent: 10 }
      : item,
  )
  return toSnapshot(saveRecord({ ...record, sessions, updatedAt: now }))
}

export function dismissLearningRecommendation(
  employeeId: string,
  recommendationId: string,
): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const recommendations = record.recommendations.map((item) =>
    item.id === recommendationId ? { ...item, dismissed: true } : item,
  )
  return toSnapshot(saveRecord({ ...record, recommendations, updatedAt: new Date().toISOString() }))
}

export function acceptLearningRecommendation(
  employeeId: string,
  recommendationId: string,
): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const recommendation = record.recommendations.find((item) => item.id === recommendationId)
  if (!recommendation) return toSnapshot(record)

  const session = createLearningSession({
    employeeId,
    skillName: recommendation.skillName,
    type: recommendation.kind === 'runtime' ? 'runtime' : 'study',
    title: recommendation.title,
    description: recommendation.summary,
    status: 'planned',
    progressPercent: 0,
    experienceGain: recommendation.priority === 'high' ? 5 : 3,
    relatedProjectId: recommendation.kind === 'project' ? AI_PHOTO_LAB_PROJECT_ID : undefined,
  })

  const recommendations = record.recommendations.map((item) =>
    item.id === recommendationId ? { ...item, dismissed: true } : item,
  )

  return toSnapshot(
    saveRecord({
      ...record,
      sessions: [session, ...record.sessions],
      recommendations,
      updatedAt: new Date().toISOString(),
    }),
  )
}

export function recordRuntimeLearning(
  employeeId: string,
  runId: string,
  reportId?: string | null,
): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const primaryGoal = record.goals.find((goal) => goal.status === 'active')
  const skillName = primaryGoal?.skillName ?? 'Coding'

  const session = createLearningSession({
    employeeId,
    skillName,
    type: 'runtime',
    title: 'Runtime execution learning',
    description: 'Experience gained from completing a runtime orchestration run.',
    status: 'completed',
    progressPercent: 100,
    experienceGain: 4,
    relatedRunId: runId,
    relatedReportId: reportId ?? undefined,
    completedAt: new Date().toISOString(),
  })

  let updated: EmployeeLearningRecord = {
    ...record,
    sessions: [session, ...record.sessions],
    updatedAt: new Date().toISOString(),
  }
  updated = applySkillGain(updated, skillName, session.experienceGain)

  addExperienceEvent(employeeId, {
    type: 'training',
    description: `Runtime learning session completed (${runId})`,
    impact: 'high',
    reportId: reportId ?? undefined,
  })

  const recommendation = updated.recommendations.find(
    (item) => !item.dismissed && item.kind === 'runtime',
  )
  if (recommendation) {
    updated = {
      ...updated,
      recommendations: updated.recommendations.map((item) =>
        item.id === recommendation.id ? { ...item, dismissed: true } : item,
      ),
    }
  }

  return toSnapshot(saveRecord(updated))
}

export function refreshLearningRecommendations(employeeId: string): EmployeeLearningSnapshot {
  const record = ensureRecord(employeeId)
  const now = new Date().toISOString()
  const activeGoals = record.goals.filter((goal) => goal.status === 'active')
  const existingTitles = new Set(record.recommendations.map((item) => item.title))
  const newRecommendations: LearningRecommendation[] = []

  for (const goal of activeGoals) {
    if (goal.currentPercent >= goal.targetPercent) continue
    const title = `Advance ${goal.skillName} to ${goal.targetPercent}%`
    if (existingTitles.has(title)) continue
    newRecommendations.push(
      createLearningRecommendation({
        employeeId,
        skillName: goal.skillName,
        kind: 'study',
        title,
        summary: `Automatic suggestion — close the ${goal.targetPercent - goal.currentPercent}% gap.`,
        priority: 'medium',
        href: `/ops/employees/${employeeId}/learning`,
        createdAt: now,
      }),
    )
  }

  if (newRecommendations.length === 0) return toSnapshot(record)

  return toSnapshot(
    saveRecord({
      ...record,
      recommendations: [...newRecommendations, ...record.recommendations],
      updatedAt: now,
    }),
  )
}

export function getSkillPercent(snapshot: EmployeeLearningSnapshot, skillName: string): number {
  return snapshot.skillProgress[skillName] ?? inferSkillPercent(snapshot.employeeId, skillName)
}
