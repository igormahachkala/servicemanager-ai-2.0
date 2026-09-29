export type MobileHomeQuickFilter = 'urgent' | 'awaiting' | 'myaction' | 'rework' | null

type Props = {
  /**
   * SMA-120: точное число срочных из ответа доски (meta.urgentTotal).
   * undefined означает «неизвестно» — счётчик не пришёл. Это не ноль:
   * карточка в таком случае не рисуется вовсе, чтобы не заявлять,
   * будто срочных нет.
   */
  urgentCount: number | undefined
  awaitingCount: number
  myActionCount: number
  reworkCount: number
  activeQuickFilter: MobileHomeQuickFilter
  onToggleUrgent: () => void
  onToggleAwaiting: () => void
  onToggleMyAction: () => void
  onToggleRework: () => void
  onPlanning: () => void
}

/** Быстрые карты главной (Figma HomeScreen): Требуют доработки / На приёмке / Требует действия / Планирование. Иконки — Tabler SVG, без эмодзи. */
export function HomeQuickCards({
  urgentCount,
  awaitingCount,
  myActionCount,
  reworkCount,
  activeQuickFilter,
  onToggleUrgent,
  onToggleAwaiting,
  onToggleMyAction,
  onToggleRework,
  onPlanning,
}: Props) {
  const myActionActive = activeQuickFilter === 'myaction'
  const urgentActive = activeQuickFilter === 'urgent'
  const reworkActive = activeQuickFilter === 'rework'
  return (
    <div className="mobileHomeQuickCards">
      {/* E2: «Требуют доработки» — заявки, возвращённые на доработку (только для техника/мастера; count=0 → скрыта) */}
      {/*
        SMA-120: «Срочные заявки» — priority=URGENT в уже разрешённом охвате.
        Счётчик приходит с сервера; при count 0 карточка скрыта, как и соседние,
        и ложной тревоги не создаёт. При неизвестном счётчике её тоже нет —
        нарисовать «0 срочных» значило бы соврать о том, чего мы не знаем.
      */}
      {typeof urgentCount === 'number' && urgentCount > 0 ? (
        <button
          type="button"
          className={`mobileHomeQuickCard mobileHomeQuickCard--rose${urgentActive ? ' mobileHomeQuickCard--roseActive' : ''}`}
          onClick={onToggleUrgent}
        >
          <span className="mobileHomeQuickCardIcon" aria-hidden>
            {/* Tabler alert-triangle */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <span className="mobileHomeQuickCardBody">
            <span className="mobileHomeQuickCardTitle">Срочные заявки</span>
            <span className="mobileHomeQuickCardSub">{urgentCount} в работе</span>
          </span>
          <span className="mobileHomeQuickCardBadge">{urgentCount}</span>
        </button>
      ) : null}

      {reworkCount > 0 ? (
        <button
          type="button"
          className={`mobileHomeQuickCard mobileHomeQuickCard--rose${reworkActive ? ' mobileHomeQuickCard--roseActive' : ''}`}
          onClick={onToggleRework}
        >
          <span className="mobileHomeQuickCardIcon" aria-hidden>
            {/* Tabler arrow-back-up */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14l-4 -4l4 -4" />
              <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
            </svg>
          </span>
          <span className="mobileHomeQuickCardBody">
            <span className="mobileHomeQuickCardTitle">Требуют доработки</span>
            <span className="mobileHomeQuickCardSub">{reworkCount} возвращено на доработку</span>
          </span>
          <span className="mobileHomeQuickCardBadge">{reworkCount}</span>
        </button>
      ) : null}

      {awaitingCount > 0 ? (
        <button
          type="button"
          className={`mobileHomeQuickCard mobileHomeQuickCard--amber${activeQuickFilter === 'awaiting' ? ' mobileHomeQuickCard--active' : ''}`}
          onClick={onToggleAwaiting}
        >
          <span className="mobileHomeQuickCardIcon" aria-hidden>
            {/* Tabler clipboard-check */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <span className="mobileHomeQuickCardBody">
            <span className="mobileHomeQuickCardTitle">На приёмке</span>
            <span className="mobileHomeQuickCardSub">{awaitingCount} заявок ожидают решения</span>
          </span>
          <span className="mobileHomeQuickCardChevron" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      ) : null}

      {myActionCount > 0 ? (
        <button
          type="button"
          className={`mobileHomeQuickCard mobileHomeQuickCard--violet${myActionActive ? ' mobileHomeQuickCard--violetActive' : ''}`}
          onClick={onToggleMyAction}
        >
          <span className="mobileHomeQuickCardIcon" aria-hidden>
            {/* Tabler bolt */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 3 13 10 19 10 11 21 11 14 5 14 13 3" />
            </svg>
          </span>
          <span className="mobileHomeQuickCardBody">
            <span className="mobileHomeQuickCardTitle">Требует моего действия</span>
            <span className="mobileHomeQuickCardSub">{myActionCount} заявок</span>
          </span>
          <span className="mobileHomeQuickCardBadge">{myActionCount}</span>
        </button>
      ) : null}

      {/* TODO(mobile-v3): в проде нет модуля планирования смен — карта-заглушка под будущий раздел (Figma HomeScreen). */}
      <button
        type="button"
        className="mobileHomeQuickCard mobileHomeQuickCard--violet mobileHomeQuickCard--stub"
        onClick={onPlanning}
      >
        <span className="mobileHomeQuickCardIcon" aria-hidden>
          {/* Tabler calendar */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <span className="mobileHomeQuickCardBody">
          <span className="mobileHomeQuickCardTitle">Планирование</span>
          <span className="mobileHomeQuickCardSub">Раздел в разработке</span>
        </span>
        <span className="mobileHomeQuickCardChevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>
    </div>
  )
}
