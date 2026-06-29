export type LessonCategory = 'finding' | 'mistake' | 'improvement' | 'knowledge'

export type LessonLearned = {
  id: string
  category: LessonCategory
  title: string
  content: string
}

export type MemoryEvolutionRecord = {
  id: string
  runId: string
  reportId: string | null
  taskId: string | null
  employeeId: string
  workspaceId: string | null
  lessons: LessonLearned[]
  memoryEntryIds: string[]
  knowledgeItemIds: string[]
  experienceEventId: string | null
  experiencePoints: number
  createdAt: string
}

export type MemoryEvolutionStats = {
  totalEvolutions: number
  todayLessons: number
  todayExperience: number
  todayKnowledge: number
  todayMemory: number
}

export type MemoryEvolutionTodaySummary = {
  learnedToday: LessonLearned[]
  experienceGained: number
  knowledgeAdded: number
  memoryAdded: number
  records: MemoryEvolutionRecord[]
}
