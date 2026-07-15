/**
 * Conversation Memory — read-path regression (AI-COMPANY-115C).
 */

import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry.ts'
import { buildEmployeeConversationContext } from './conversationMemoryContext.ts'
import { CONVERSATION_MEMORY_SYNC_EVENT } from './conversationMemoryTypes.ts'
import { refreshEmployeeWorkingMemory } from './conversationMemoryWorkingMemory.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const listeners = new Map<string, Set<EventListener>>()

  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  const windowLike = {
    localStorage: storage as Storage,
    addEventListener: (type: string, listener: EventListener) => {
      const bucket = listeners.get(type) ?? new Set<EventListener>()
      bucket.add(listener)
      listeners.set(type, bucket)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event)
      }
      return true
    },
    location: { origin: 'http://localhost:5173', hostname: 'localhost' },
  }

  ;(globalThis as { window?: typeof windowLike }).window = windowLike
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

describe('buildEmployeeConversationContext read path', () => {
  beforeEach(() => {
    installStorageMock()
  })

  it('does not emit sync when building context repeatedly', () => {
    let syncCount = 0
    window.addEventListener(CONVERSATION_MEMORY_SYNC_EVENT, () => {
      syncCount += 1
    })

    buildEmployeeConversationContext(BUILDER_EMPLOYEE_ID)
    buildEmployeeConversationContext(BUILDER_EMPLOYEE_ID)

    assert.equal(syncCount, 0)
  })

  it('emits sync only when working memory content changes', () => {
    let syncCount = 0
    window.addEventListener(CONVERSATION_MEMORY_SYNC_EVENT, () => {
      syncCount += 1
    })

    refreshEmployeeWorkingMemory(BUILDER_EMPLOYEE_ID, [])
    assert.equal(syncCount, 1)

    refreshEmployeeWorkingMemory(BUILDER_EMPLOYEE_ID, [])
    assert.equal(syncCount, 1)

    buildEmployeeConversationContext(BUILDER_EMPLOYEE_ID)
    assert.equal(syncCount, 1)
  })
})
