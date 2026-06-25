import { MEMORY_TYPES } from '../../domain/memory/memoryTypes'
import { MEMORY_IMPORTANCE_LEVELS } from '../../domain/memory/memoryImportance'
import type { MemoryFilter } from '../../domain/memory/memoryEntry'
import { useI18n } from '../../i18n'

export function MemoryFilters(props: {
  filter: MemoryFilter
  tags: string[]
  onChange: (filter: MemoryFilter) => void
}) {
  const { t } = useI18n()

  return (
    <div className="mcMemoryFilters">
      <label className="mcField mcMemoryFilterField">
        <span className="mcFieldLabel">{t.memoryEngine.filters.type}</span>
        <select
          className="mcInput"
          value={props.filter.type ?? 'all'}
          onChange={(event) =>
            props.onChange({ ...props.filter, type: event.target.value as MemoryFilter['type'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {MEMORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.memoryEngine.types[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcMemoryFilterField">
        <span className="mcFieldLabel">{t.memoryEngine.filters.importance}</span>
        <select
          className="mcInput"
          value={props.filter.importance ?? 'all'}
          onChange={(event) =>
            props.onChange({
              ...props.filter,
              importance: event.target.value as MemoryFilter['importance'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {MEMORY_IMPORTANCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t.memoryEngine.importance[level]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcMemoryFilterField">
        <span className="mcFieldLabel">{t.memoryEngine.filters.tag}</span>
        <select
          className="mcInput"
          value={props.filter.tag ?? 'all'}
          onChange={(event) =>
            props.onChange({ ...props.filter, tag: event.target.value })
          }
        >
          <option value="all">{t.common.all}</option>
          {props.tags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
