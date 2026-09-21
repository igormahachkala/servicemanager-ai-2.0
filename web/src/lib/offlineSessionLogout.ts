/**
 * SMA-OFFLINE-QUEUE-OWNER-IDENTITY-HARDENING-005.
 *
 * Переходник между экранами и единой политикой уборки офлайна. Сама политика
 * живёт в `mobile/offline/logout.ts` и ничего не знает ни про `lib/api`, ни
 * про экраны: слой очереди собирается отдельным узким tsconfig. Здесь
 * подставляются настоящие зависимости.
 *
 * Все пять поверхностей закрытия сессии — профиль `/m`, десктопный Shell,
 * истечение сессии в роутере, MAX и выбор рабочего пространства — ходят сюда
 * и различаются только поводом (mode). Своей политики ни у одной из них нет.
 */

import * as api from './api'
import { clearLegacyOfflineCaches } from '../mobile/offlineQueue'
import { identityFromToken } from '../mobile/offline/identity'
import {
  runOfflineLogout,
  type OfflineLogoutIdentity,
  type OfflineLogoutMode,
  type OfflineLogoutResult,
} from '../mobile/offline/logout'
import { hasUnsentWork, stopOffline, wipeOfflineOnLogout } from '../mobile/offline/runtime'

export type { OfflineLogoutMode, OfflineLogoutResult }

/**
 * Убрать офлайн-слой перед закрытием сессии.
 *
 * Вызывать ДО сброса токена: личность берётся из него, когда `/auth/me`
 * недоступен, и после сброса определить владельца базы будет нечем.
 *
 * Возвращает `proceed: false`, только если человек отказался терять
 * неотправленную работу — тогда выход не продолжается.
 */
export async function offlineAwareLogout(
  mode: OfflineLogoutMode,
  options: {
    identity?: OfflineLogoutIdentity
    confirm?: (message: string) => boolean
  } = {},
): Promise<OfflineLogoutResult> {
  const identity =
    options.identity && options.identity.id && options.identity.companyId
      ? options.identity
      : identityFromToken(api.getToken())

  return runOfflineLogout(mode, {
    identity,
    hasUnsentWork,
    wipe: wipeOfflineOnLogout,
    stop: stopOffline,
    confirm: options.confirm,
    clearLegacyCaches: clearLegacyOfflineCaches,
  })
}
