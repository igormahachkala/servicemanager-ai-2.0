import { extractLessonsFromCompletion } from '../memoryEvolution/memoryEvolutionEngine'
import type { LessonLearned } from '../memoryEvolution/memoryEvolution'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'

/** Draft memory evolution — not persisted to Employee Memory in V1. */
export type MemoryEvolutionDraft = {
  runId: string
  reportId: string
  employeeId: string
  workspaceId: string | null
  lessons: LessonLearned[]
  estimatedExperiencePoints: number
  status: 'draft'
  note: string
}

const EXPERIENCE_BY_CATEGORY: Record<LessonLearned['category'], number> = {
  finding: 2,
  mistake: 3,
  improvement: 2,
  knowledge: 4,
}

function estimateExperience(lessons: LessonLearned[]): number {
  return lessons.reduce((sum, lesson) => sum + EXPERIENCE_BY_CATEGORY[lesson.category], 0)
}

export function buildMemoryEvolutionDraft(run: RuntimeRun, report: Report): MemoryEvolutionDraft {
  const lessons = extractLessonsFromCompletion(run, report)

  return {
    runId: run.id,
    reportId: report.id,
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    lessons,
    estimatedExperiencePoints: estimateExperience(lessons),
    status: 'draft',
    note: 'Черновик V1 — публикация в Employee Memory после одобрения Owner (V2).',
  }
}

export type KnowledgeCandidateDraft = {
  id: string
  title: string
  summary: string
  content: string
  type: 'documentation' | 'best_practice' | 'runbook'
  source: 'max-worker-loop'
  status: 'draft'
  tags: string[]
  ownerEmployeeId: string
  workspaceId: string | null
  runId: string
  lessonCategory: LessonLearned['category']
}

export function buildKnowledgeCandidateDrafts(
  run: RuntimeRun,
  lessons: LessonLearned[],
): KnowledgeCandidateDraft[] {
  return lessons
    .filter((lesson) => lesson.category === 'finding' || lesson.category === 'knowledge')
    .map((lesson, index) => ({
      id: `kc-draft-${run.id}-${index}`,
      title: lesson.title,
      summary: lesson.content.slice(0, 320),
      content: lesson.content,
      type: lesson.category === 'knowledge' ? 'best_practice' : 'documentation',
      source: 'max-worker-loop' as const,
      status: 'draft' as const,
      tags: ['max-worker-loop', 'knowledge-candidate', `run-${run.id}`, lesson.category],
      ownerEmployeeId: run.employeeId,
      workspaceId: run.workspaceId,
      runId: run.id,
      lessonCategory: lesson.category,
    }))
}

export type MaxWorkerLoopNextAction = {
  id: string
  label: string
  priority: 'high' | 'medium' | 'low'
  kind: 'owner_decision' | 'recommendation' | 'follow_up'
}

export function buildMaxWorkerLoopNextActions(report: Report): MaxWorkerLoopNextAction[] {
  const actions: MaxWorkerLoopNextAction[] = []
  let index = 0

  const ownerDecision = report.runtimeBody?.ownerDecisionRequired?.trim()
  if (ownerDecision && !/^нет$/i.test(ownerDecision)) {
    actions.push({
      id: `next-${index++}`,
      label: ownerDecision,
      priority: 'high',
      kind: 'owner_decision',
    })
  }

  const nextStep = report.runtimeBody?.nextStep?.trim()
  if (nextStep) {
    actions.push({
      id: `next-${index++}`,
      label: nextStep,
      priority: 'high',
      kind: 'follow_up',
    })
  }

  for (const recommendation of report.recommendations.slice(0, 5)) {
    actions.push({
      id: `next-${index++}`,
      label: recommendation,
      priority: 'medium',
      kind: 'recommendation',
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: 'next-default',
      label: 'Просмотрите Runtime Report и подтвердите следующий шаг в Run Task.',
      priority: 'low',
      kind: 'follow_up',
    })
  }

  return actions
}
