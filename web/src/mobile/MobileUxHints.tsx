import type { Role } from '../lib/api'
import { explainClaimUnavailable, genericTechnicianBoardClaimHint } from '../lib/claimAvailabilityHints'

const LS_HOME_INTRO = 'sma_seen_mobile_home_tabs_intro_v1'

export function readMobileHomeIntroDismissed(): boolean {
  try {
    return localStorage.getItem(LS_HOME_INTRO) === '1'
  } catch {
    return true
  }
}

export function dismissMobileHomeIntro(): void {
  try {
    localStorage.setItem(LS_HOME_INTRO, '1')
  } catch {
    /* ignore */
  }
}

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

export function MobileHomeTabsIntroBanner(props: { role: Role | undefined; onDismiss: () => void }) {
  if (props.role !== 'TECHNICIAN') return null
  return (
    <div className="mobileUxHintIntro" role="region" aria-label="Подсказка по вкладкам">
      <div className="mobileUxHintIntroTitle">Как пользоваться списком</div>
      <ul className="mobileUxHintIntroList">
        <li>
          <strong>Все</strong> — полный список заявок в контуре; отсюда можно «Взять» или «Запросить назначение».
        </li>
        <li>
          <strong>Мои</strong> — заявки, назначенные на вас.
        </li>
        <li>
          <strong>В работе</strong> — назначенные и начатые по контуру.
        </li>
      </ul>
      <button type="button" className="mobileUxHintIntroDismiss mobileBtn mobileBtnSecondary" onClick={props.onDismiss}>
        Понятно
      </button>
    </div>
  )
}

export function MobileTechnicianFirstStepsCard(props: { show: boolean }) {
  if (!props.show) return null
  return (
    <div className="mobileUxHintIntro mobileUxHintIntro--steps" role="region" aria-label="С чего начать">
      <div className="mobileUxHintIntroTitle">Чтобы начать работу</div>
      <ol className="mobileUxHintIntroOrdered">
        <li>Найдите заявку во вкладке «Все».</li>
        <li>Нажмите «Взять» (если доступно) или «Запросить назначение».</li>
        <li>После назначения заявка появится во вкладке «Мои».</li>
      </ol>
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
        Если техник не видит заявку или не может взять её: проверьте специализации, привязку категорий к специализациям и доступ к точкам (UserLocationBinding) в веб-версии.
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
