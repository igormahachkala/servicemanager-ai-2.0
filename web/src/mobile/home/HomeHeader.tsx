import * as api from '../../lib/api'
import { MobileRoleContextStrip } from '../MobileUxHints'
import { formatMobileMutationError } from '../mobileActionErrors'
import type { MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'

type Props = {
  me: Awaited<ReturnType<typeof api.me>> | undefined
  isOnline: boolean
  boardHasData: boolean
  boardError: unknown
  companyPrimaryLine: string
  linkedClientCompanyId: string
  linkedClientDisplayName: string
  techNoLinked: boolean
  techBoundPending: boolean
  techWillRedirectForScope: boolean
  techBoundError: unknown
  techBoundEmpty: boolean
  tabCounts?: Record<MobileHomeBoardFilterTab, number>
  onStatClick?: (tab: MobileHomeBoardFilterTab) => void
  activeBoardTab?: MobileHomeBoardFilterTab
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function HomeHeader(props: Props) {
  const {
    me,
    isOnline,
    boardHasData,
    boardError,
    companyPrimaryLine,
    linkedClientCompanyId,
    linkedClientDisplayName,
    techNoLinked,
    techBoundPending,
    techWillRedirectForScope,
    techBoundError,
    techBoundEmpty,
    tabCounts,
    onStatClick,
    activeBoardTab,
    searchQuery,
    setSearchQuery,
  } = props

  const displayName = [me?.firstName, me?.lastName].filter(Boolean).join(' ').trim() || me?.email || 'Пользователь'
  const displayInitials =
    ([me?.firstName, me?.lastName].filter(Boolean).map((s) => (s || '').trim().charAt(0)).join('') ||
      (me?.email || '').charAt(0)).toUpperCase() || '—'
  const roleLabel =
    me?.role === 'TECHNICIAN' ? 'Техник' : me?.role === 'CLIENT' ? 'Клиент' : me?.role === 'PLATFORM_ADMIN' ? 'Платформа' : 'Администратор'

  return (
    <>
      {/* Figma Make HomeScreen header: kicker + name + avatar-initials + online·role */}
      <div className="mobileHomeHeaderCard">
        <div className="mobileHomeHeaderTop">
          <div className="mobileHomeHeaderTitleWrap">
            <p className="mobileHomeHeaderKicker">Управление объектами</p>
            <h1 className="mobileHomeHeaderName">{displayName}</h1>
          </div>
          <div className="mobileHomeHeaderAvatar" aria-hidden>{displayInitials}</div>
        </div>
        <div className="mobileHomeHeaderOnline">
          <span className="mobileHomeHeaderOnlineDot" aria-hidden />
          {isOnline ? 'Онлайн' : 'Оффлайн'} · {roleLabel}
        </div>
        {/* Figma HomeScreen search bar (prominent, moved up from the filters panel) */}
        <label className="mobileHomeSearchBar">
          <svg className="mobileHomeSearchBarIcon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="mobileVisuallyHidden">Поиск заявок по загруженному списку</span>
          <input
            className="mobileHomeSearchBarInput"
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Объект, адрес, заявка, категория, №..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button type="button" className="mobileHomeSearchBarClear" aria-label="Очистить поиск" onClick={() => setSearchQuery('')}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </label>
      </div>
      <div style={{ marginBottom: 4 }}>
        {me ? <MobileRoleContextStrip role={me.role} /> : null}
        {!isOnline && boardHasData ? <div className="mobileStaleDataBanner" role="status">Показаны сохранённые данные</div> : null}
      </div>

      {tabCounts ? (
        <div className="mobileStatsGrid">
          {(
            [
              { tab: 'new' as MobileHomeBoardFilterTab, count: tabCounts.new, label: 'Новые', cls: 'mobileStatBlock--new' },
              { tab: 'in_work' as MobileHomeBoardFilterTab, count: tabCounts.in_work, label: 'В работе', cls: 'mobileStatBlock--inwork' },
              { tab: 'overdue' as MobileHomeBoardFilterTab, count: tabCounts.overdue, label: 'Просрочено', cls: 'mobileStatBlock--overdue' },
              { tab: 'done' as MobileHomeBoardFilterTab, count: tabCounts.done, label: 'Завершено', cls: 'mobileStatBlock--done' },
            ] as const
          ).map(({ tab, count, label, cls }) => (
            <div
              key={tab}
              className={`mobileStatBlock ${cls}${onStatClick ? ' mobileStatBlock--tap' : ''}${activeBoardTab === tab ? ' mobileStatBlock--active' : ''}`}
              onClick={onStatClick ? () => onStatClick(tab) : undefined}
            >
              <div className="mobileStatValue">{count}</div>
              <div className="mobileStatLabel">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {(companyPrimaryLine || linkedClientCompanyId) ? (
        <div className="mobileCard" style={{ padding: '10px 12px', marginBottom: 4 }}>
          <div className="mobileMeta">
            <div><span className="mobileContextLabel">Компания:</span> {companyPrimaryLine}</div>
            {linkedClientCompanyId ? (
              <div style={{ marginTop: 4 }}>
                <span className="mobileContextLabel">Клиент:</span> {linkedClientDisplayName || '—'}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {boardError ? (
        <div className="mobileNotice mobileNoticeError">
          {formatMobileMutationError(boardError, { operation: 'other' })}
        </div>
      ) : null}

      {techNoLinked ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {techBoundPending ? <div className="mobileNotice">Определяем клиентский контур…</div> : null}
          {techWillRedirectForScope ? <div className="mobileNotice">Подключаем клиентский контур…</div> : null}
          {techBoundError ? (
            <div className="mobileNotice mobileNoticeError">{(techBoundError as any)?.message || String(techBoundError)}</div>
          ) : null}
          {!techBoundPending && !techBoundError && techBoundEmpty ? (
            <div className="mobileNotice" style={{ border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' }}>
              Не выбран клиентский контур
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
