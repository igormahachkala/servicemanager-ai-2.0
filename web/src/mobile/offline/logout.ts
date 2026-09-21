/**
 * SMA-OFFLINE-QUEUE-OWNER-IDENTITY-HARDENING-005.
 *
 * Единая политика уборки офлайн-слоя при закрытии сессии. До 005 её знал
 * один экран — профиль в `/m`, — а четыре других пути просто сбрасывали токен
 * и оставляли базу предыдущего пользователя на общем планшете.
 *
 * Политика одна, но у закрытия сессии два разных повода, и путать их нельзя.
 *
 *   user_initiated — человек нажал «Выйти». Приватные данные уходят вместе
 *                    с сессией. Если работа не отправлена, спрашиваем до
 *                    удаления: молча потерять рабочий день нельзя.
 *
 *   session_lost   — сессия кончилась сама: истёк токен, сервер ответил 401,
 *                    привязка MAX оказалась чужой. Человек ничего не решал
 *                    и спросить его негде. Удалять здесь нельзя — это была бы
 *                    потеря данных по чужой инициативе, хуже исходной дыры.
 *                    Работа остаётся в базе своего владельца и уйдёт, когда
 *                    он войдёт снова.
 *
 * Что закрывает утечку в обоих случаях — не удаление, а сверка владельца
 * перед отправкой (см. sync.ts). Здесь мы только останавливаем разбор очереди
 * и, если это осознанный выход, убираем приватное.
 *
 * Модуль намеренно без импортов из `lib/`: слой очереди собирается отдельным
 * узким tsconfig. Всё, что нужно снаружи, приходит параметрами.
 */

export type OfflineLogoutMode = 'user_initiated' | 'session_lost'

export type OfflineLogoutIdentity = { id?: string | null; companyId?: string | null } | null

export type OfflineLogoutDeps = {
  /** Чья сессия закрывается. Если не знаем — уборка всё равно выполнится. */
  identity: OfflineLogoutIdentity
  /** Сколько работы не ушло. Спрашивается только для осознанного выхода. */
  hasUnsentWork: () => Promise<{ unsent: number; attention: number }>
  /** Удалить базу этого пользователя целиком. */
  wipe: (identity: OfflineLogoutIdentity) => Promise<void>
  /** Остановить разбор очереди и отменить идущий круг. */
  stop: () => void
  /** Подтверждение пользователя. По умолчанию — window.confirm. */
  confirm?: (message: string) => boolean
  /** Прежние кэши в localStorage, не разделённые по пользователю. */
  clearLegacyCaches?: () => void
}

export type OfflineLogoutResult = {
  /** Можно продолжать выход: сбрасывать токен и уходить на /login. */
  proceed: boolean
  /** База пользователя удалена. */
  wiped: boolean
  unsent: number
  attention: number
}

/** Текст предупреждения. Отдельной функцией, чтобы его можно было проверить. */
export function unsentWorkWarning(unsent: number, attention: number): string {
  const parts = [
    unsent > 0 ? `не отправлено записей: ${unsent}` : '',
    attention > 0 ? `требует внимания: ${attention}` : '',
  ]
    .filter(Boolean)
    .join(', ')
  return (
    `На устройстве осталась несинхронизированная работа (${parts}).\n\n` +
    'Выход удалит её безвозвратно. Если есть сеть, сначала дождитесь отправки.\n\n' +
    'Выйти и удалить?'
  )
}

function defaultConfirm(message: string): boolean {
  if (typeof window === 'undefined') return true
  return window.confirm(message)
}

/**
 * Единственная точка уборки офлайна при закрытии сессии. Вызывается до сброса
 * токена: после сброса отправлять уже нечем, и спрашивать поздно.
 */
export async function runOfflineLogout(
  mode: OfflineLogoutMode,
  deps: OfflineLogoutDeps,
): Promise<OfflineLogoutResult> {
  // Разбор очереди останавливается всегда и первым делом: и при выходе,
  // и при потере сессии круг, начатый под прежней личностью, дальше не идёт.
  deps.stop()

  if (mode === 'session_lost') {
    return { proceed: true, wiped: false, unsent: 0, attention: 0 }
  }

  const { unsent, attention } = await deps.hasUnsentWork()
  if (unsent > 0 || attention > 0) {
    const ask = deps.confirm ?? defaultConfirm
    if (!ask(unsentWorkWarning(unsent, attention))) {
      return { proceed: false, wiped: false, unsent, attention }
    }
  }

  await deps.wipe(deps.identity)
  deps.clearLegacyCaches?.()
  return { proceed: true, wiped: true, unsent, attention }
}
