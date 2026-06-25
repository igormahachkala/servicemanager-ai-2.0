import { KNOWLEDGE_SOURCES } from '../../domain/knowledge/knowledgeSource'
import { KNOWLEDGE_STATUSES } from '../../domain/knowledge/knowledge'
import { KNOWLEDGE_TYPES } from '../../domain/knowledge/knowledgeType'
import type { KnowledgeFilter } from '../../domain/knowledge/knowledgeStorage'
import { useI18n } from '../../i18n'

type Props = {
  filter: KnowledgeFilter
  tags: string[]
  onChange: (next: KnowledgeFilter) => void
}

export function KnowledgeFilters({ filter, tags, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcKnowledgeFilters">
      <label className="mcKnowledgeFilterField">
        <span className="mcFieldLabel">{t.knowledgeEngine.filters.status}</span>
        <select
          className="mcInput"
          value={filter.status}
          onChange={(event) =>
            onChange({ ...filter, status: event.target.value as KnowledgeFilter['status'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {KNOWLEDGE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t.knowledgeEngine.statuses[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcKnowledgeFilterField">
        <span className="mcFieldLabel">{t.knowledgeEngine.filters.type}</span>
        <select
          className="mcInput"
          value={filter.type}
          onChange={(event) =>
            onChange({ ...filter, type: event.target.value as KnowledgeFilter['type'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {KNOWLEDGE_TYPES.map((item) => (
            <option key={item} value={item}>
              {t.knowledgeEngine.types[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcKnowledgeFilterField">
        <span className="mcFieldLabel">{t.knowledgeEngine.filters.source}</span>
        <select
          className="mcInput"
          value={filter.source}
          onChange={(event) =>
            onChange({ ...filter, source: event.target.value as KnowledgeFilter['source'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {KNOWLEDGE_SOURCES.map((item) => (
            <option key={item} value={item}>
              {t.knowledgeEngine.sources[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcKnowledgeFilterField">
        <span className="mcFieldLabel">{t.knowledgeEngine.filters.workspace}</span>
        <select
          className="mcInput"
          value={filter.workspaceId}
          onChange={(event) => onChange({ ...filter, workspaceId: event.target.value })}
        >
          <option value="all">{t.common.all}</option>
          <option value="none">{t.knowledgeEngine.platformWide}</option>
          <option value="ws-sma">ws-sma</option>
        </select>
      </label>

      <label className="mcKnowledgeFilterField">
        <span className="mcFieldLabel">{t.knowledgeEngine.filters.tag}</span>
        <select
          className="mcInput"
          value={filter.tag}
          onChange={(event) => onChange({ ...filter, tag: event.target.value })}
        >
          <option value="all">{t.common.all}</option>
          {tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
