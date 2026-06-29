import type { LessonCategory, MemoryEvolutionRecord } from '../../domain/memoryEvolution'
import { useMemoryEvolution } from '../../hooks/useMemoryEvolution'
import { useI18n } from '../../i18n'

type Props = {
  employeeId?: string
  runId?: string
  compact?: boolean
}

const CATEGORY_CLASS: Record<LessonCategory, string> = {
  finding: 'acMevoLessonFinding',
  mistake: 'acMevoLessonMistake',
  improvement: 'acMevoLessonImprovement',
  knowledge: 'acMevoLessonKnowledge',
}

function EvolutionMetrics({
  experienceGained,
  knowledgeAdded,
  memoryAdded,
  lessonsCount,
  compact,
}: {
  experienceGained: number
  knowledgeAdded: number
  memoryAdded: number
  lessonsCount: number
  compact?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className={`acMevoMetrics${compact ? ' acMevoMetricsCompact' : ''}`}>
      <div className="acMevoMetric">
        <span className="acMevoMetricValue">{lessonsCount}</span>
        <span className="acMevoMetricLabel">{t.memoryEvolution.todayLearned}</span>
      </div>
      <div className="acMevoMetric">
        <span className="acMevoMetricValue">+{experienceGained}</span>
        <span className="acMevoMetricLabel">{t.memoryEvolution.experienceGained}</span>
      </div>
      <div className="acMevoMetric">
        <span className="acMevoMetricValue">{knowledgeAdded}</span>
        <span className="acMevoMetricLabel">{t.memoryEvolution.knowledgeAdded}</span>
      </div>
      <div className="acMevoMetric">
        <span className="acMevoMetricValue">{memoryAdded}</span>
        <span className="acMevoMetricLabel">{t.memoryEvolution.memoryAdded}</span>
      </div>
    </div>
  )
}

function LessonsList({ record }: { record: MemoryEvolutionRecord }) {
  const { t } = useI18n()

  if (record.lessons.length === 0) {
    return <p className="acMuted">{t.memoryEvolution.noLessons}</p>
  }

  return (
    <ul className="acMevoLessons">
      {record.lessons.map((lesson) => (
        <li key={lesson.id} className={`acMevoLesson ${CATEGORY_CLASS[lesson.category]}`}>
          <span className="acMevoLessonCategory">{t.memoryEvolution.categories[lesson.category]}</span>
          <strong>{lesson.title}</strong>
          <p>{lesson.content}</p>
        </li>
      ))}
    </ul>
  )
}

export function MemoryEvolutionPanel({ employeeId, runId, compact = false }: Props) {
  const { t } = useI18n()
  const { runEvolution, today } = useMemoryEvolution({ employeeId, runId })

  if (runId && runEvolution) {
    return (
      <section className={`acMevoPanel${compact ? ' acMevoPanelCompact' : ''}`}>
        <div className="acMevoPanelTitle">{t.memoryEvolution.runEvolutionTitle}</div>
        <EvolutionMetrics
          experienceGained={runEvolution.experiencePoints}
          knowledgeAdded={runEvolution.knowledgeItemIds.length}
          memoryAdded={runEvolution.memoryEntryIds.length}
          lessonsCount={runEvolution.lessons.length}
          compact={compact}
        />
        <LessonsList record={runEvolution} />
      </section>
    )
  }

  if (employeeId && today && today.records.length > 0) {
    return (
      <section className={`acMevoPanel${compact ? ' acMevoPanelCompact' : ''}`}>
        <div className="acMevoPanelTitle">{t.memoryEvolution.todayTitle}</div>
        <EvolutionMetrics
          experienceGained={today.experienceGained}
          knowledgeAdded={today.knowledgeAdded}
          memoryAdded={today.memoryAdded}
          lessonsCount={today.learnedToday.length}
          compact={compact}
        />
        {today.learnedToday.slice(0, compact ? 3 : 6).map((lesson) => (
          <div key={lesson.id} className={`acMevoLessonInline ${CATEGORY_CLASS[lesson.category]}`}>
            <span className="acMevoLessonCategory">{t.memoryEvolution.categories[lesson.category]}</span>
            <span>{lesson.title}</span>
          </div>
        ))}
      </section>
    )
  }

  return (
    <section className={`acMevoPanel acMevoPanelEmpty${compact ? ' acMevoPanelCompact' : ''}`}>
      <p className="acMuted">{t.memoryEvolution.empty}</p>
    </section>
  )
}

export function MemoryEvolutionSummary({ employeeId }: { employeeId: string }) {
  const { stats } = useMemoryEvolution({ employeeId })

  if (stats.todayLessons === 0) return null

  return (
    <MemoryEvolutionPanel employeeId={employeeId} compact />
  )
}
