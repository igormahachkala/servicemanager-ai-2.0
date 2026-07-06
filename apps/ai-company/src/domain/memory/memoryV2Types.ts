/**
 * Memory V2 — типы и маппинг V1 → V2.
 *
 * НЕ подключено к Runtime orchestrator в 095.
 * Используется для планирования, UI-прототипов и миграции без изменения текущего flow.
 *
 * @see docs/ai-company/AI-COMPANY-095-memory-v2.md
 */

import type { LessonCategory } from '../memoryEvolution/memoryEvolution'
import type { MemoryEntry } from './memoryEntry'
import type { MemoryRetention } from './memoryRetention'
import type { MemoryType } from './memoryTypes'

/** Слой памяти — где живёт запись в модели цифрового сотрудника. */
export const MEMORY_LAYERS_V2 = [
  'short_term',
  'working',
  'long_term',
  'corporate',
] as const

export type MemoryLayerV2 = (typeof MEMORY_LAYERS_V2)[number]

/** Семантика опыта — что сотрудник «вынес» из события. */
export const MEMORY_EXPERIENCE_KINDS_V2 = [
  'error',
  'successful_decision',
  'reusable_knowledge',
  'general_experience',
] as const

export type MemoryExperienceKindV2 = (typeof MEMORY_EXPERIENCE_KINDS_V2)[number]

/** Происхождение записи (расширение V1 source + evolution). */
export const MEMORY_PROVENANCE_V2 = [
  'runtime_run',
  'memory_evolution',
  'owner_manual',
  'conversation',
  'seed_onboarding',
  'competency',
  'system',
] as const

export type MemoryProvenanceV2 = (typeof MEMORY_PROVENANCE_V2)[number]

/**
 * Целевая форма записи Memory V2 (draft — не персистится в 095).
 * V1 `MemoryEntry` остаётся canonical storage до фазы миграции.
 */
export type MemoryEntryV2Draft = {
  id: string
  employeeId: string
  companyId: string | null
  layer: MemoryLayerV2
  experienceKind: MemoryExperienceKindV2
  provenance: MemoryProvenanceV2
  title: string
  summary: string
  content: string
  tags: string[]
  workspaceId: string | null
  runId: string | null
  reportId: string | null
  evolutionRecordId: string | null
  knowledgeItemId: string | null
  importance: MemoryEntry['importance']
  retention: MemoryRetention
  createdAt: string
  updatedAt: string
  /** V1 entry id для обратной совместимости при миграции */
  v1EntryId: string | null
}

/** Маппинг V1 retention → V2 layer. */
export function mapRetentionToLayerV2(retention: MemoryRetention): MemoryLayerV2 {
  switch (retention) {
    case 'session':
      return 'short_term'
    case 'short':
      return 'working'
    case 'long':
      return 'long_term'
    case 'permanent':
      return 'corporate'
  }
}

/** Маппинг V1 memory type → V2 experience kind. */
export function mapMemoryTypeToExperienceKindV2(type: MemoryType): MemoryExperienceKindV2 {
  switch (type) {
    case 'experience':
      return 'general_experience'
    case 'decision':
      return 'successful_decision'
    case 'knowledge':
    case 'document':
    case 'report':
      return 'reusable_knowledge'
    case 'conversation':
    case 'relationship':
    case 'task':
    case 'workspace':
      return 'general_experience'
  }
}

/** Маппинг lesson category из Memory Evolution → V2 experience kind. */
export function mapLessonCategoryToExperienceKindV2(
  category: LessonCategory,
): MemoryExperienceKindV2 {
  switch (category) {
    case 'mistake':
      return 'error'
    case 'improvement':
      return 'successful_decision'
    case 'finding':
    case 'knowledge':
      return 'reusable_knowledge'
  }
}

function inferProvenanceV2(entry: MemoryEntry): MemoryProvenanceV2 {
  if (entry.id.startsWith('memory-seed-')) return 'seed_onboarding'
  if (entry.tags.includes('lessons-learned') || entry.source === 'run') return 'memory_evolution'
  if (entry.source === 'manual') return 'owner_manual'
  if (entry.source === 'conversation' || entry.source === 'discussion') return 'conversation'
  return 'system'
}

function extractRunIdFromTags(tags: string[]): string | null {
  const tag = tags.find((item) => item.startsWith('run-'))
  if (!tag) return null
  if (tag.startsWith('run-run-')) return tag.slice(4)
  return tag
}

/** Безопасный read-only проектор V1 → V2 draft (без записи в storage). */
export function projectMemoryEntryToV2Draft(
  entry: MemoryEntry,
  companyId: string | null = null,
): MemoryEntryV2Draft {
  return {
    id: `mv2-draft-${entry.id}`,
    employeeId: entry.employeeId,
    companyId,
    layer: mapRetentionToLayerV2(entry.retention),
    experienceKind: mapMemoryTypeToExperienceKindV2(entry.type),
    provenance: inferProvenanceV2(entry),
    title: entry.title,
    summary: entry.summary,
    content: entry.content,
    tags: entry.tags,
    workspaceId: entry.workspaceId,
    runId: extractRunIdFromTags(entry.tags),
    reportId: null,
    evolutionRecordId: null,
    knowledgeItemId: null,
    importance: entry.importance,
    retention: entry.retention,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    v1EntryId: entry.id,
  }
}
