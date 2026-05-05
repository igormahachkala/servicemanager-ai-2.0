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
}

export function HomeChips({
  searchQuery,
  setSearchQuery,
  activeChips,
  toggleChip,
  visibleCount,
  filterSummary,
}: Props) {
  return (
    <>
      <label className="mobileHomeSearchWrap">
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

      <div className="mobileChipRow" role="group" aria-label="Быстрые фильтры">
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

      <div className="mobileHomeResultRow">
        <span className="mobileMeta">Найдено: {visibleCount}</span>
        {filterSummary ? (
          <span className="mobileMeta mobileHomeResultFilters" title={filterSummary}>
            {filterSummary}
          </span>
        ) : null}
      </div>
    </>
  )
}
