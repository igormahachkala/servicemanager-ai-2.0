import type { KnowledgeSource } from './knowledgeSource'
import type { KnowledgeType } from './knowledgeType'
import type { KnowledgeTag } from './knowledgeTag'

export const KNOWLEDGE_STATUSES = ['draft', 'published', 'archived'] as const

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number]

export type Knowledge = {
  id: string
  title: string
  summary: string
  content: string
  type: KnowledgeType
  source: KnowledgeSource
  tags: KnowledgeTag[]
  workspaceId: string | null
  ownerEmployeeId: string | null
  status: KnowledgeStatus
  createdAt: string
  updatedAt: string
}
