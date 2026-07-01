import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { MemoryTimeline } from '../components/memory/MemoryTimeline'
import { MemoryEvolutionPanel } from '../components/memory-evolution'
import { MemoryStats } from '../components/memory/MemoryStats'
import { MemorySearch } from '../components/memory/MemorySearch'
import { MemoryFilters } from '../components/memory/MemoryFilters'
import { MemorySummary } from '../components/memory/MemorySummary'
import { resolveEmployee } from '../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'
import { MEMORY_TYPES } from '../domain/memory/memoryTypes'
import { MEMORY_IMPORTANCE_LEVELS } from '../domain/memory/memoryImportance'
import type { MemoryType } from '../domain/memory/memoryTypes'
import type { MemoryImportance } from '../domain/memory/memoryImportance'
import { useMemory } from '../hooks/useMemory'
import { useI18n } from '../i18n'

export function EmployeeMemoryPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const employeeId = routeId ? resolveCanonicalEmployeeId(routeId) : undefined
  const { t } = useI18n()
  const employee = useMemo(
    () => (employeeId ? resolveEmployee(employeeId) : null),
    [employeeId],
  )
  const { filtered, stats, tags, query, setQuery, filter, setFilter, add } = useMemory(employeeId)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [type, setType] = useState<MemoryType>('knowledge')
  const [importance, setImportance] = useState<MemoryImportance>('normal')

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t.memoryEngine.notFoundTitle}
          description={t.memoryEngine.notFoundDescription}
        />
        <div className="mcMemoryEmpty">
          <div className="mcMemoryEmptyTitle">{t.memoryEngine.notFoundTitle}</div>
          <p className="mcMemoryEmptyDesc">{t.memoryEngine.notFoundDescription}</p>
          <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
            {t.employeeProfile.backToEmployees}
          </Link>
        </div>
      </>
    )
  }

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !summary.trim()) return
    add({
      type,
      title: title.trim(),
      summary: summary.trim(),
      content: summary.trim(),
      importance,
      source: 'manual',
      tags: ['manual'],
    })
    setTitle('')
    setSummary('')
  }

  return (
    <div className="mcMemoryPage">
      <div className="mcMemoryPageHeader">
        <Link to={`/ops/employees/${employeeId}`} className="mcProfileBack">
          ← {t.memoryEngine.backToProfile}
        </Link>
        <PageHeader
          title={t.memoryEngine.pageTitle.replace('{name}', employee.codename)}
          description={t.memoryEngine.pageDescription}
        />
      </div>

      <Panel title={t.memoryEngine.summary.title}>
        <div className="mcProfilePanelBody">
          <MemorySummary />
        </div>
      </Panel>

      <Panel title={t.memoryEvolution.todayTitle}>
        <div className="mcProfilePanelBody">
          <MemoryEvolutionPanel employeeId={employeeId} compact />
        </div>
      </Panel>

      <MemoryStats stats={stats} />

      <Panel title={t.memoryEngine.timelineTitle}>
        <div className="mcProfilePanelBody mcStack">
          <MemorySearch value={query} onChange={setQuery} />
          <MemoryFilters filter={filter} tags={tags} onChange={setFilter} />
          <MemoryTimeline entries={filtered} />
        </div>
      </Panel>

      <Panel title={t.memoryEngine.addTitle}>
        <form className="mcFormBody" onSubmit={handleAdd}>
          <div className="mcProfileFieldGrid">
            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.title}</span>
              <input
                className="mcInput"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.memoryEngine.addTitlePlaceholder}
              />
            </label>
            <label className="mcField">
              <span className="mcFieldLabel">{t.memoryEngine.addSummaryLabel}</span>
              <input
                className="mcInput"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder={t.memoryEngine.addSummaryPlaceholder}
              />
            </label>
            <label className="mcField">
              <span className="mcFieldLabel">{t.memoryEngine.filters.type}</span>
              <select
                className="mcInput"
                value={type}
                onChange={(event) => setType(event.target.value as MemoryType)}
              >
                {MEMORY_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {t.memoryEngine.types[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mcField">
              <span className="mcFieldLabel">{t.memoryEngine.filters.importance}</span>
              <select
                className="mcInput"
                value={importance}
                onChange={(event) => setImportance(event.target.value as MemoryImportance)}
              >
                {MEMORY_IMPORTANCE_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {t.memoryEngine.importance[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mcFormActions">
            <button type="submit" className="mcBtn mcBtnPrimary">
              {t.memoryEngine.addButton}
            </button>
          </div>
        </form>
      </Panel>

      <p className="mcMemoryLocalNote">{t.memoryEngine.localOnly}</p>
    </div>
  )
}
