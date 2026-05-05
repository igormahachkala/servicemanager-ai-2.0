import * as api from '../../lib/api'
import { MobileRoleContextStrip } from '../MobileUxHints'
import { formatMobileMutationError } from '../mobileActionErrors'

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
  } = props

  return (
    <>
      <div>
        <h1 className="mobileTitle">Главная</h1>
        <div className="mobileSubtitle">Операционный экран без desktop-шумов</div>
        {me ? <MobileRoleContextStrip role={me.role} /> : null}
        {!isOnline && boardHasData ? <div className="mobileStaleDataBanner" role="status">Показаны сохранённые данные</div> : null}
      </div>

      <div className="mobileCard" style={{ padding: 12 }}>
        <div className="mobileMeta">
          <div><span className="mobileContextLabel">Компания:</span> {companyPrimaryLine}</div>
          {linkedClientCompanyId ? (
            <div style={{ marginTop: 6 }}>
              <span className="mobileContextLabel">Клиент:</span> {linkedClientDisplayName || '—'}
            </div>
          ) : null}
        </div>
      </div>

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
