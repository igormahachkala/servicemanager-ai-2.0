/** Единый текст для online-only действий (claim, assignment, round complete, …). */
export const ONLINE_ONLY_ACTION_MESSAGE = 'Для этого действия нужен интернет.'

/**
 * Offline-вход в заявку, которой нет в кэше на устройстве.
 * Без сети карточку не из чего нарисовать: сервер недоступен, локального снимка нет.
 */
export const OFFLINE_TICKET_NOT_CACHED_MESSAGE =
  'Заявка не подгружена! Для отображения необходимо стабильное интернет-соединение.'
