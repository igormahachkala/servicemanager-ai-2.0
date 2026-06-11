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
  } = props

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="mobileTitle">Мои заявки</h1>
        {me ? <MobileRoleContextStrip role={me.role} /> : null}
        {!isOnline && boardHasData ? <div className="mobileStaleDataBanner" role="status">Показаны сохранённые данные</div> : null}
      </div>

      {tabCounts ? (
        <div className="mobileStatsGrid">
          {(
            [
              { tab: 'new' as MobileHomeBoardFilterTab, count: tabCounts.new, label: 'Новые', cls: 'mobileStatBlock--new' },
              { tab: 'in_work' as MobileHomeBoardFilterTab, count: tabCounts.in_work, label: 'В работе', cls: 'mobileStatBlock--inwork' },
              { tab: 'overdue' as MobileHomeBoardFilterTab, count: tabCounts.overdue, label: 'Просроченные', cls: 'mobileStatBlock--overdue' },
              { tab: 'done' as MobileHomeBoardFilterTab, count: tabCounts.done, label: 'Завершённые', cls: 'mobileStatBlock--done' },
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
