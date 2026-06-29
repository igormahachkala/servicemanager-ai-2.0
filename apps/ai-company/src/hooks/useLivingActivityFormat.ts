import { useCallback } from 'react'
import {
  formatLivingRelativeTime,
  livingVerbBucket,
  type LivingActivitySnapshot,
} from '../domain/living'
import { useI18n } from '../i18n'

export function useLivingActivityFormat() {
  const { t } = useI18n()

  const formatActivity = useCallback(
    (snapshot: LivingActivitySnapshot): string => {
      if (snapshot.source === 'runtime' && snapshot.stepId) {
        const pipeline = t.livingCompany.pipeline as Record<string, string>
        if (pipeline[snapshot.stepId]) return pipeline[snapshot.stepId]
      }

      if (snapshot.source === 'task_result') {
        const statuses = t.livingCompany.taskResult as Record<string, string>
        const key =
          snapshot.phase === 'waiting'
            ? 'ready_for_review'
            : snapshot.phase === 'reviewing'
              ? 'reviewing'
              : snapshot.phase === 'completed'
                ? 'completed'
                : snapshot.phase === 'idle'
                  ? 'idle'
                  : 'working'
        if (statuses[key]) return statuses[key]
      }

      const bucket = livingVerbBucket(snapshot)
      const verbs = t.livingCompany.verbs[bucket as keyof typeof t.livingCompany.verbs]
      const contextLower = snapshot.context.toLowerCase()

      if (verbs && typeof verbs === 'object') {
        if (contextLower.includes('upload') && 'upload' in verbs) return verbs.upload as string
        if (
          (contextLower.includes('architect') || contextLower.includes('architecture')) &&
          'architecture' in verbs
        ) {
          return verbs.architecture as string
        }
        if (
          (contextLower.includes('deploy') ||
            contextLower.includes('devops') ||
            contextLower.includes('health') ||
            contextLower.includes('environment')) &&
          'environment' in verbs
        ) {
          return verbs.environment as string
        }
        if (
          (contextLower.includes('qa') ||
            contextLower.includes('checklist') ||
            contextLower.includes('regression')) &&
          'regression' in verbs
        ) {
          return verbs.regression as string
        }
        if ('task' in verbs) {
          return (verbs.task as string).replace('{task}', snapshot.context)
        }
      }

      return t.livingCompany.fallback.replace('{context}', snapshot.context)
    },
    [t],
  )

  const formatSince = useCallback(
    (iso: string | null): string | null => {
      const relative = formatLivingRelativeTime(iso)
      if (!relative) return null
      if (relative === 'now') return t.livingCompany.now
      return t.livingCompany.since.replace('{time}', relative)
    },
    [t],
  )

  const phaseLabel = useCallback(
    (phase: LivingActivitySnapshot['phase']) => t.livingCompany.phases[phase],
    [t],
  )

  return { formatActivity, formatSince, phaseLabel }
}
