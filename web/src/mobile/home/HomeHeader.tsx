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
          <div className="mobileStatBlock mobileStatBlock--new">
            <div className="mobileStatValue">{tabCounts.new}</div>
            <div className="mobileStatLabel">Новые</div>
          </div>
          <div className="mobileStatBlock mobileStatBlock--inwork">
            <div className="mobileStatValue">{tabCounts.in_work}</div>
            <div className="mobileStatLabel">В работе</div>
          </div>
          <div className="mobileStatBlock mobileStatBlock--overdue">
            <div className="mobileStatValue">{tabCounts.overdue}</div>
            <div className="mobileStatLabel">Просроченные</div>
          </div>
          <div className="mobileStatBlock mobileStatBlock--done">
            <div className="mobileStatValue">{tabCounts.done}</div>
            <div className="mobileStatLabel">Завершённые</div>
          </div>
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
