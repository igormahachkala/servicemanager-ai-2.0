import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  buildEmployeeConversationContext,
  CONVERSATION_MEMORY_SYNC_EVENT,
  getConversationMemoryStats,
  type EmployeeConversationContext,
} from '../../domain/conversationMemory'
import { MOBILE_EMPLOYEE_CHAT_SYNC_EVENT } from '../chat/mobileEmployeeChat'

export type MobileEmployeeConversationMemorySnapshot = {
  context: EmployeeConversationContext
  messageCount: number
  windowSize: number
  hasWorkingMemory: boolean
}

export function useMobileEmployeeConversationMemory(employeeId: string) {
  const { pathname } = useLocation()
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(MOBILE_EMPLOYEE_CHAT_SYNC_EVENT, onChange)
    window.addEventListener(CONVERSATION_MEMORY_SYNC_EVENT, onChange)
    return () => {
      window.removeEventListener(MOBILE_EMPLOYEE_CHAT_SYNC_EVENT, onChange)
      window.removeEventListener(CONVERSATION_MEMORY_SYNC_EVENT, onChange)
    }
  }, [refresh])

  const snapshot = useMemo((): MobileEmployeeConversationMemorySnapshot => {
    void tick
    const context = buildEmployeeConversationContext(employeeId)
    const stats = getConversationMemoryStats(context)
    return {
      context,
      messageCount: stats.messageCount,
      windowSize: stats.windowSize,
      hasWorkingMemory: stats.hasWorkingMemory,
    }
  }, [employeeId, tick])

  return { snapshot, refresh }
}
