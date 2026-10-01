/**
 * Снимок `/auth/me` на устройстве.
 *
 * После перезагрузки без сети react-query пуст, а профиль и оболочка
 * всё равно должны знать имя и роль техника. Снимок пишется при успешном
 * ответе сервера и читается, когда запрос к `/auth/me` недоступен.
 */

import type { Me } from '../../lib/api'

const ME_CACHE_KEY = 'sm_mobile_me_cache_v1'

export function readMeCache(): Me | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Me
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.id || !parsed.companyId) return null
    return parsed
  } catch {
    return null
  }
}

export function writeMeCache(me: Me): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me))
  } catch {
    // Квота или приватный режим — профиль offline просто останется пустым.
  }
}

export function clearMeCache(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(ME_CACHE_KEY)
  } catch {
    // ignore
  }
}
