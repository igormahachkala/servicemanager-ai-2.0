export const KNOWLEDGE_ASSIGNMENT_STATUSES = ['assigned', 'in_progress', 'completed'] as const

export type KnowledgeAssignmentStatus = (typeof KNOWLEDGE_ASSIGNMENT_STATUSES)[number]

export type KnowledgeAssignment = {
  id: string
  employeeId: string
  knowledgeId: string | null
  collectionId: string | null
  status: KnowledgeAssignmentStatus
  note: string | null
  assignedAt: string
  dueAt: string | null
}
