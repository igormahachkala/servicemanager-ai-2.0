import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LearningGoal } from '../domain/learning/learningGoal'
import type { LearningRecommendation } from '../domain/learning/learningRecommendation'
import type { LearningSession } from '../domain/learning/learningSession'
import {
  CHANGE_EVENT,
  acceptLearningRecommendation,
  buildLearningStats,
  completeLearningSession,
  dismissLearningRecommendation,
  getEmployeeLearningSnapshot,
  getSkillPercent,
  getSkillProgressForChart,
  readLearningStorageKey,
  refreshLearningRecommendations,
  startLearningSession,
  type EmployeeLearningSnapshot,
  type LearningStats,
  type SkillProgressPoint,
} from '../domain/learning/learningStorage'

export function useLearning(employeeId: string | undefined) {
  const [snapshot, setSnapshot] = useState<EmployeeLearningSnapshot | null>(() =>
    employeeId ? getEmployeeLearningSnapshot(employeeId) : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setSnapshot(null)
      return
    }
    setSnapshot(getEmployeeLearningSnapshot(employeeId))
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === readLearningStorageKey()) refresh()
    }
    const onChange = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [refresh])

  const stats = useMemo<LearningStats | null>(
    () => (snapshot ? buildLearningStats(snapshot) : null),
    [snapshot],
  )

  const completeSession = useCallback(
    (sessionId: string) => {
      if (!employeeId) return
      setSnapshot(completeLearningSession(employeeId, sessionId))
    },
    [employeeId],
  )

  const startSession = useCallback(
    (sessionId: string) => {
      if (!employeeId) return
      setSnapshot(startLearningSession(employeeId, sessionId))
    },
    [employeeId],
  )

  const dismissRecommendation = useCallback(
    (recommendationId: string) => {
      if (!employeeId) return
      setSnapshot(dismissLearningRecommendation(employeeId, recommendationId))
    },
    [employeeId],
  )

  const acceptRecommendation = useCallback(
    (recommendationId: string) => {
      if (!employeeId) return
      setSnapshot(acceptLearningRecommendation(employeeId, recommendationId))
    },
    [employeeId],
  )

  const refreshRecommendations = useCallback(() => {
    if (!employeeId) return
    setSnapshot(refreshLearningRecommendations(employeeId))
  }, [employeeId])

  const getSkillProgress = useCallback(
    (skillName?: string): SkillProgressPoint[] =>
      snapshot ? getSkillProgressForChart(snapshot, skillName) : [],
    [snapshot],
  )

  const skillPercent = useCallback(
    (skillName: string): number => (snapshot ? getSkillPercent(snapshot, skillName) : 0),
    [snapshot],
  )

  return {
    sessions: (snapshot?.sessions ?? []) as LearningSession[],
    recentSessions: (snapshot?.recentSessions ?? []) as LearningSession[],
    goals: (snapshot?.goals ?? []) as LearningGoal[],
    activeGoals: (snapshot?.activeGoals ?? []) as LearningGoal[],
    recommendations: (snapshot?.recommendations ?? []) as LearningRecommendation[],
    pendingRecommendations: (snapshot?.pendingRecommendations ?? []) as LearningRecommendation[],
    skillProgress: snapshot?.skillProgress ?? {},
    skillProgressHistory: snapshot?.skillProgressHistory ?? [],
    certificatesEarned: snapshot?.certificatesEarned ?? 0,
    stats,
    completeSession,
    startSession,
    dismissRecommendation,
    acceptRecommendation,
    refreshRecommendations,
    getSkillProgress,
    skillPercent,
    refresh,
  }
}
