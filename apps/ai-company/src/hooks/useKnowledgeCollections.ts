import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ensureSeedKnowledge,
  getCollectionById,
  loadKnowledgeCollections,
  loadKnowledgeStore,
  type KnowledgeCollection,
} from '../domain/knowledge/knowledgeStorage'

export function useKnowledgeCollections() {
  const [collections, setCollections] = useState<KnowledgeCollection[]>([])

  const refresh = useCallback(() => {
    ensureSeedKnowledge()
    setCollections(loadKnowledgeCollections())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-knowledge-collections') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const withItems = useMemo(() => {
    const store = loadKnowledgeStore()
    return collections.map((collection) => ({
      ...collection,
      knowledgeItems: collection.items
        .map((id) => store.items.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined),
    }))
  }, [collections])

  return {
    collections,
    collectionsWithItems: withItems,
    refresh,
    getById: (id: string) => getCollectionById(id),
  }
}

export type { KnowledgeCollection }
