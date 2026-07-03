import type { Role } from '../lib/api'
import { explainClaimUnavailable, genericTechnicianBoardClaimHint } from '../lib/claimAvailabilityHints'

export function MobileClaimReasonHintBox(props: { reason: string | null | undefined; className?: string }) {
  const { title, detail } = explainClaimUnavailable(props.reason)
  return (
    <div className={`mobileUxHintReason${props.className ? ` ${props.className}` : ''}`} role="status">
      <div className="mobileUxHintReasonTitle">{title}</div>
      {detail ? <div className="mobileUxHintReasonDetail">{detail}</div> : null}
    </div>
  )
}

export function MobileBoardClaimFallbackHint() {
  return (
    <div className="mobileUxHintReason mobileUxHintReason--compact" role="status">
      <div className="mobileUxHintReasonDetail">{genericTechnicianBoardClaimHint()}</div>
    </div>
  )
}

function isProviderStaffRole(role: Role | undefined): boolean {
  if (!role) return false
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR' ||
    role === 'TERRITORIAL_MANAGER'
  )
}

export function MobileRoleContextStrip(props: { role: Role | undefined }) {
  const { role } = props
  if (role === 'TECHNICIAN') {
    return (
      <div className="mobileUxRoleStrip mobileUxRoleStrip--tech" role="note">
        Полевые действия — на карточке заявки. Если «Взять» недоступен, смотрите пояснение над кнопкой или запросите назначение.
      </div>
    )
  }
  if (isProviderStaffRole(role)) {
    return (
      <div className="mobileUxRoleStrip mobileUxRoleStrip--admin" role="note">
        Если техник не видит заявку или не может взять её: проверьте специализации, привязку категорий и доступ к точкам.
      </div>
    )
  }
  if (role === 'PLATFORM_ADMIN') {
    return (
      <div className="mobileUxRoleStrip mobileUxRoleStrip--platform" role="note">
        Платформенный контур: убедитесь, что выбрана нужная компания в параметрах URL/профиля, прежде чем смотреть заявки клиента.
      </div>
    )
  }
  return null
}
