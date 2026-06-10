import {
  MOBILE_HOME_BOARD_CHIP_IDS,
  MOBILE_HOME_BOARD_CHIP_LABELS,
  type MobileHomeBoardChipId,
} from '../mobileHomeBoardFilters'

type Props = {
  searchQuery: string
  setSearchQuery: (value: string) => void
  activeChips: Set<MobileHomeBoardChipId>
  toggleChip: (id: MobileHomeBoardChipId) => void
  visibleCount: number
  filterSummary: string
  onResetAll: () => void
  hasActiveFilters: boolean
}

export function HomeChips({
  searchQuery,
  setSearchQuery,
  activeChips,
  toggleChip,
  visibleCount,
  filterSummary,
  onResetAll,
  hasActiveFilters,
}: Props) {
  return (
    <div className="mobileFiltersPanel">
      <div className="mobileFiltersPanelHeader">
        <span className="mobileFiltersPanelTitle">Фильтры</span>
        <button
          type="button"
          className="mobileBtn mobileBtnSecondary"
          style={{ fontSize: '0.78rem', padding: '4px 12px', minHeight: 30 }}
          onClick={onResetAll}
          disabled={!hasActiveFilters}
        >
          Сбросить
        </button>
      </div>
      <div className="mobileFiltersPanelBody">
        <label className="mobileHomeSearchWrap" style={{ margin: 0 }}>
          <span className="mobileVisuallyHidden">Поиск заявок по загруженному списку</span>
          <input
            className="mobileHomeSearchInput"
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Поиск: номер, адрес, точка, проблема"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <div>
          <div className="mobileMeta" style={{ marginBottom: 6, fontWeight: 600 }}>Быстрые фильтры</div>
          <div className="mobileChipRow" role="group" aria-label="Быстрые фильтры" style={{ flexWrap: 'wrap', gap: 6 }}>
            {MOBILE_HOME_BOARD_CHIP_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`mobileFilterChip${activeChips.has(id) ? ' mobileFilterChipActive' : ''}`}
                aria-pressed={activeChips.has(id)}
                onClick={() => toggleChip(id)}
              >
                {MOBILE_HOME_BOARD_CHIP_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="mobileRow" style={{ paddingTop: 4 }}>
          <span className="mobileMeta">Найдено: <strong>{visibleCount}</strong></span>
          {filterSummary ? (
            <span className="mobileMeta" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filterSummary}>
              {filterSummary}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
