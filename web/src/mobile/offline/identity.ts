/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Кто работает на устройстве — без обращения к серверу.
 *
 * Пространство имён офлайн-хранилища строится из компании и пользователя,
 * и раньше они брались только из ответа `/auth/me`. Без сети этот запрос
 * не выполняется вовсе: react-query держит его приостановленным. Значит,
 * после перезагрузки в подвале офлайн-слой не открывался совсем — техник
 * не видел сохранённый обход, а новая работа не сохранялась, потому что
 * хранилища не существовало. Найдено живой приёмкой на Stage.
 *
 * Личность берётся из уже лежащего на устройстве токена. Это тот же токен,
 * которым потом уйдёт очередь, поэтому расхождения между «чья очередь»
 * и «от чьего имени отправляем» быть не может. Ничего нового на устройстве
 * не сохраняется, подпись не проверяется и доверия токену не прибавляется:
 * из него читаются два идентификатора, а все права по-прежнему проверяет
 * сервер.
 */

export type OfflineIdentityHint = { id: string; companyId: string } | null

function decodeSegment(segment: string): unknown {
  // base64url → JSON. Любая неожиданность означает «личности нет».
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return JSON.parse(decodeURIComponent(escape(json)))
}

export function identityFromToken(token: string | null | undefined): OfflineIdentityHint {
  const raw = (token || '').trim()
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length < 2) return null
  try {
    const payload = decodeSegment(parts[1]) as { sub?: unknown; userId?: unknown; companyId?: unknown }
    const id = String(payload.userId ?? payload.sub ?? '').trim()
    const companyId = String(payload.companyId ?? '').trim()
    if (!id || !companyId) return null
    return { id, companyId }
  } catch {
    return null
  }
}
