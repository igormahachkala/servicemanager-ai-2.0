import type { CSSProperties } from 'react'
import { SESSION_TEMPORARY_UNAVAILABLE_MESSAGE } from '../lib/sessionContinuity'

type SessionRecoveryNoticeProps = {
  variant?: 'desktop' | 'mobile'
  className?: string
  style?: CSSProperties
}

export function SessionRecoveryNotice(props: SessionRecoveryNoticeProps) {
  if (props.variant === 'mobile') {
    return (
      <div
        className={`mobileOfflineBanner mobileOfflineBannerWarning${props.className ? ` ${props.className}` : ''}`}
        role="status"
        aria-live="polite"
        style={props.style}
      >
        <div>{SESSION_TEMPORARY_UNAVAILABLE_MESSAGE}</div>
      </div>
    )
  }

  return (
    <div
      className={`alert${props.className ? ` ${props.className}` : ''}`}
      role="status"
      aria-live="polite"
      style={props.style}
    >
      {SESSION_TEMPORARY_UNAVAILABLE_MESSAGE}
    </div>
  )
}
