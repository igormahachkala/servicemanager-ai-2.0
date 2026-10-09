import { Link } from 'react-router-dom'

type Props = {
  text: string
  at: string
  href?: string | null
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const pillStyle = {
  maxWidth: '85%',
  background: '#f3f4f6',
  color: '#374151',
  borderRadius: 999,
  padding: '8px 12px',
  wordBreak: 'break-word' as const,
  whiteSpace: 'pre-wrap' as const,
  fontSize: '0.85rem',
  textAlign: 'center' as const,
  lineHeight: 1.4,
}

const textStyle = {
  fontWeight: 600,
  color: 'inherit',
  textDecoration: 'none' as const,
}

export function SystemChatCapsule({ text, at, href }: Props) {
  const body = href ? (
    <Link to={href} style={textStyle}>
      {text}
    </Link>
  ) : (
    <div style={textStyle}>{text}</div>
  )

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={pillStyle}>
        {body}
        <div className="muted small" style={{ marginTop: 2, fontSize: '0.72rem' }}>
          {fmt(at)}
        </div>
      </div>
    </div>
  )
}
