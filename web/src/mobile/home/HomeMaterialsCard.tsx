import { Link } from 'react-router-dom'

type Props = {
  to: string
  label: string
  hint: string
}

/**
 * SMA-MATERIALS-V0: заметный вход «Материалы» на мобильной Главной. Переиспользует
 * визуальный стиль быстрых карт (`mobileHomeQuickCard`) — нового navigation-паттерна
 * не вводит, это обычная router-ссылка на /m/materials.
 */
export function HomeMaterialsCard({ to, label, hint }: Props) {
  return (
    <div className="mobileHomeQuickCards">
      <Link
        to={to}
        className="mobileHomeQuickCard mobileHomeQuickCard--violet"
        style={{ textDecoration: 'none', color: 'inherit' }}
        data-testid="mobile-home-materials-entry"
      >
        <span className="mobileHomeQuickCardIcon" aria-hidden>
          {/* Tabler package */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 4.5v9L12 21l-8 -4.5v-9z" />
            <path d="M12 12l8 -4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L4 7.5" />
          </svg>
        </span>
        <span className="mobileHomeQuickCardBody">
          <span className="mobileHomeQuickCardTitle">{label}</span>
          <span className="mobileHomeQuickCardSub">{hint}</span>
        </span>
        <span className="mobileHomeQuickCardChevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </Link>
    </div>
  )
}
