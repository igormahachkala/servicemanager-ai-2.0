import { addExperienceEvent } from '../competencies/competencyStorage'
import { emitEvent } from '../events/eventStorage'
import { createKnowledgeItem } from '../knowledge/knowledgeStorage'
import { createMemory } from '../memory/memory'
import type { Report } from '../reports/report'
import { getDeliveryTaskById } from '../tasks/taskStorage'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { LessonCategory, LessonLearned, MemoryEvolutionRecord } from './memoryEvolution'
import { getEvolutionByRunId, upsertEvolutionRecord } from './memoryEvolutionStorage'

const EXPERIENCE_BY_CATEGORY: Record<LessonCategory, number> = {
  finding: 2,
  mistake: 3,
  improvement: 2,
  knowledge: 4,
}

function lessonId(prefix: string, index: number): string {
  return `lesson-${prefix}-${index}`
}

function truncate(text: string, max = 320): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function extractLessonsFromCompletion(run: RuntimeRun, report: Report): LessonLearned[] {
  const lessons: LessonLearned[] = []
  let index = 0

  for (const finding of report.findings) {
    lessons.push({
      id: lessonId('finding', index++),
      category: 'finding',
      title: truncate(finding, 72),
      content: finding,
    })
  }

  for (const risk of report.risks) {
    lessons.push({
      id: lessonId('mistake', index++),
      category: 'mistake',
      title: truncate(risk, 72),
      content: risk,
    })
  }

  for (const recommendation of report.recommendations) {
    lessons.push({
      id: lessonId('improvement', index++),
      category: 'improvement',
      title: truncate(recommendation, 72),
      content: recommendation,
    })
  }

  for (const warning of run.result?.warnings ?? []) {
    lessons.push({
      id: lessonId('mistake', index++),
      category: 'mistake',
      title: truncate(warning.message, 72),
      content: `${warning.severity.toUpperCase()}: ${warning.message}`,
    })
  }

  const responseText = run.result?.responseText?.trim()
  if (responseText && responseText.length >= 80) {
    lessons.push({
      id: lessonId('knowledge', index++),
      category: 'knowledge',
      title: 'Reusable runtime output',
      content: truncate(responseText, 600),
    })
  }

  return lessons
}

function memoryTypeForLesson(category: LessonCategory): 'knowledge' | 'experience' | 'decision' | 'report' {
  if (category === 'mistake') return 'experience'
  if (category === 'improvement') return 'decision'
  if (category === 'finding') return 'report'
  return 'knowledge'
}

function importanceForLesson(category: LessonCategory): 'normal' | 'high' {
  return category === 'mistake' || category === 'knowledge' ? 'high' : 'normal'
}

function experienceImpact(points: number): 'low' | 'medium' | 'high' {
  if (points >= 12) return 'high'
  if (points >= 6) return 'medium'
  return 'low'
}

function computeExperiencePoints(lessons: LessonLearned[]): number {
  return lessons.reduce((sum, lesson) => sum + EXPERIENCE_BY_CATEGORY[lesson.category], 0)
}

export function applyMemoryEvolution(run: RuntimeRun, report: Report): MemoryEvolutionRecord | null {
  if (run.status !== 'completed') return null

  const existing = getEvolutionByRunId(run.id)
  if (existing) return existing

  const lessons = extractLessonsFromCompletion(run, report)
  if (lessons.length === 0) return null

  const memoryEntryIds: string[] = []
  const knowledgeItemIds: string[] = []
  const task = run.taskId ? getDeliveryTaskById(run.taskId) : null

  for (const lesson of lessons) {
    const memory = createMemory({
      employeeId: run.employeeId,
      type: memoryTypeForLesson(lesson.category),
      title: lesson.title,
      summary: lesson.content,
      content: lesson.content,
      importance: importanceForLesson(lesson.category),
      retention: lesson.category === 'mistake' ? 'permanent' : 'long',
      tags: ['lessons-learned', lesson.category, `run-${run.id}`],
      workspaceId: run.workspaceId,
      source: 'run',
    })
    memoryEntryIds.push(memory.id)

    if (lesson.category === 'finding' || lesson.category === 'knowledge') {
      const knowledge = createKnowledgeItem({
        title: lesson.title,
        summary: lesson.content,
        content: lesson.content,
        type: lesson.category === 'knowledge' ? 'best_practice' : 'documentation',
        source: 'generated',
        tags: ['memory-evolution', `run-${run.id}`, lesson.category],
        workspaceId: run.workspaceId,
        ownerEmployeeId: run.employeeId,
        status: 'published',
      })
      knowledgeItemIds.push(knowledge.id)
    }
  }

  const summaryMemory = createMemory({
    employeeId: run.employeeId,
    type: 'experience',
    title: task ? `Lessons from ${task.title}` : `Lessons from ${report.title}`,
    summary: `${lessons.length} insights captured after runtime completion`,
    content: lessons.map((item) => `[${item.category}] ${item.title}\n${item.content}`).join('\n\n'),
    importance: 'high',
    retention: 'long',
    tags: ['lessons-learned', 'evolution-summary', `run-${run.id}`],
    workspaceId: run.workspaceId,
    source: 'run',
  })
  memoryEntryIds.push(summaryMemory.id)

  const experiencePoints = computeExperiencePoints(lessons)
  const experienceSnapshot = addExperienceEvent(run.employeeId, {
    type: 'report',
    description: `Memory evolution after ${task?.title ?? report.title}: ${lessons.length} lessons, +${experiencePoints} XP`,
    impact: experienceImpact(experiencePoints),
    workspaceId: run.workspaceId ?? undefined,
    taskId: run.taskId ?? undefined,
    reportId: report.id,
  })
  const experienceEventId = experienceSnapshot.experienceEvents[0]?.id ?? null

  const record: MemoryEvolutionRecord = {
    id: `mevo-${run.id}`,
    runId: run.id,
    reportId: report.id,
    taskId: run.taskId,
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    lessons,
    memoryEntryIds,
    knowledgeItemIds,
    experienceEventId,
    experiencePoints,
    createdAt: new Date().toISOString(),
  }

  upsertEvolutionRecord(record)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ai-company-memory-evolution-sync'))
  }

  emitEvent({
    type: 'memory.evolved',
    sourceType: 'run',
    sourceId: run.id,
    employeeId: run.employeeId,
    workspaceId: run.workspaceId,
    reportId: report.id,
    metadata: {
      title: summaryMemory.title,
      lessons: lessons.length,
      experiencePoints,
      knowledgeAdded: knowledgeItemIds.length,
      memoryAdded: memoryEntryIds.length,
      preview: lessons.slice(0, 2).map((item) => item.title).join(' · '),
    },
    severity: 'success',
  })

  for (const knowledgeId of knowledgeItemIds) {
    emitEvent({
      type: 'knowledge.updated',
      sourceType: 'knowledge',
      sourceId: knowledgeId,
      employeeId: run.employeeId,
      workspaceId: run.workspaceId,
      reportId: report.id,
      metadata: {
        action: 'created',
        origin: 'memory-evolution',
        runId: run.id,
      },
      severity: 'info',
    })
  }

  return record
}

export function onRuntimeCompletion(run: RuntimeRun, report: Report): MemoryEvolutionRecord | null {
  return applyMemoryEvolution(run, report)
}
