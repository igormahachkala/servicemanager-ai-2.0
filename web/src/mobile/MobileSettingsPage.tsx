import { Link, useLocation } from 'react-router-dom'
import { SupportContactBlock } from '../components/SupportContactBlock'
import { ClientContourCard } from './ClientContourCard'
import { mobilePath } from './mobileRoute'

/**
 * Экран «Настройки» (/m/settings). Дизайн — Figma SettingsScreen, адаптирован под прод:
 * Tabler-иконки вместо эмодзи, наши CSS-классы, «Уведомления» ведут на готовый push-экран,
 * нереализованные тумблеры/строки помечены «Скоро» и задизейблены. Первой — карточка контура
 * (общий ClientContourCard, тот же в Профиле).
 */

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

/** Задизейбленный тумблер — переиспользует CSS-класс mobilePushSwitch из push-экрана. */
function DisabledSwitch() {
  return (
    <button type="button" role="switch" aria-checked={false} aria-disabled disabled className="mobilePushSwitch">
      <span className="mobilePushSwitchThumb" />
    </button>
  )
}

export function MobileSettingsPage() {
  const location = useLocation()
  const backHref = mobilePath(location.pathname, '/profile')

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Назад
        </Link>
      </div>

      <h1 className="mobileTitle">Настройки</h1>

      {/* 1. Клиентский контур (наша добавка, первой) — общий компонент */}
      <ClientContourCard />

      {/* 2. Приложение: уведомления (ссылка на push-экран) + нереализованные тумблеры */}
      <div className="mobileCard mobileProfileMenu" style={{ marginTop: 8 }}>
        <Link to={mobilePath(location.pathname, '/push-settings')} className="mobileProfileMenuItem">
          <span className="mobileProfileMenuIcon" aria-hidden>
            {/* Tabler bell */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
              <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
            </svg>
          </span>
          <span className="mobileProfileMenuLabel">
            Уведомления
            <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>Push-уведомления о заявках</span>
          </span>
          <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
        </Link>

        <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
          <span className="mobileProfileMenuIcon" aria-hidden>
            {/* Tabler robot */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7h10a2 2 0 0 1 2 2v1l1 1v3l-1 1v3a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-3l-1 -1v-3l1 -1v-1a2 2 0 0 1 2 -2z" />
              <path d="M10 16h4" />
              <path d="M8.5 11.5l.01 0" />
              <path d="M15.5 11.5l.01 0" />
              <path d="M9 7l-1 -4" />
              <path d="M15 7l1 -4" />
            </svg>
          </span>
          <span className="mobileProfileMenuLabel">
            MAX Ассистент
            <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>ИИ-помощник для работы</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="mobileProfileMenuSoon">Скоро</span>
            <DisabledSwitch />
          </span>
        </div>

        <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
          <span className="mobileProfileMenuIcon" aria-hidden>
            {/* Tabler moon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
            </svg>
          </span>
          <span className="mobileProfileMenuLabel">
            Тёмная тема
            <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>Изменить оформление</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="mobileProfileMenuSoon">Скоро</span>
            <DisabledSwitch />
          </span>
        </div>
      </div>

      {/* 3. Навигация: язык (пока «Скоро») */}
      <div className="mobileCard mobileProfileMenu" style={{ marginTop: 8 }}>
        <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
          <span className="mobileProfileMenuIcon" aria-hidden>
            {/* Tabler world */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.6 9h16.8" />
              <path d="M3.6 15h16.8" />
              <path d="M11.5 3a17 17 0 0 0 0 18" />
              <path d="M12.5 3a17 17 0 0 1 0 18" />
            </svg>
          </span>
          <span className="mobileProfileMenuLabel">Язык</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="mobileMeta">Русский</span>
            <span className="mobileProfileMenuSoon">Скоро</span>
          </span>
        </div>
      </div>

      {/* 4. Поддержка — переиспользуем SupportContactBlock (само-заголовок «Поддержка») */}
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <SupportContactBlock titleTag="div" />
      </div>

      {/* 5. Версия */}
      <div className="mobileCard" style={{ marginTop: 8, textAlign: 'center' }}>
        <div className="mobileMeta">ServiceManager.AI · Версия 2.0.1</div>
        <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: 2 }}>Mobile UX V2 Final</div>
      </div>
    </div>
  )
}
