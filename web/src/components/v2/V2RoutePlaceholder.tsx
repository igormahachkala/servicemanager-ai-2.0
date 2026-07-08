import { Link } from 'react-router-dom'
import {
  V2_DEV_STATUS_LABEL,
  type V2DevStatus,
  type V2PageMeta,
} from '../../lib/managementConsoleV2Pages'

const STATUS_STYLE: Record<V2DevStatus, { bg: string; border: string; color: string }> = {
  planned: { bg: '#f1f5f9', border: '#cbd5e1', color: '#475569' },
  in_progress: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
  partial: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
  available: { bg: '#ecfdf5', border: '#6ee7b7', color: '#047857' },
}

type Props = V2PageMeta

export function V2RoutePlaceholder(props: Props) {
  const statusStyle = STATUS_STYLE[props.status]
  const showDashboardLink = props.path !== '/dashboard'

  return (
    <div className="v2Placeholder">
      <div className="v2PlaceholderHero panel">
        <div className="v2PlaceholderEyebrow">Management Console V2</div>
        <h1 className="v2PlaceholderTitle">{props.title}</h1>
        <p className="v2PlaceholderDescription">{props.description}</p>

        <div className="v2PlaceholderMeta">
          <span
            className="v2PlaceholderStatus"
            style={{
              background: statusStyle.bg,
              borderColor: statusStyle.border,
              color: statusStyle.color,
            }}
          >
            {V2_DEV_STATUS_LABEL[props.status]}
          </span>
          {props.taskRef ? <span className="v2PlaceholderTask">{props.taskRef}</span> : null}
        </div>

        <div className="v2PlaceholderActions">
          {props.legacyPath ? (
            <Link to={props.legacyPath} className="v2PlaceholderLinkSecondary">
              {props.legacyLabel || 'Открыть связанный раздел'}
            </Link>
          ) : null}
          {showDashboardLink ? (
            <Link to="/dashboard" className="v2PlaceholderLink">
              Вернуться на Dashboard
            </Link>
          ) : null}
        </div>
      </div>

      <div className="v2PlaceholderNote panel">
        <div className="v2PlaceholderNoteTitle">Navigation V2</div>
        <div className="muted small">
          Маршрут зарегистрирован — 404 не возникнет. Полная реализация экрана будет добавлена в рамках
          Operations Center без изменения backend-контрактов на этом этапе.
        </div>
      </div>
    </div>
  )
}
