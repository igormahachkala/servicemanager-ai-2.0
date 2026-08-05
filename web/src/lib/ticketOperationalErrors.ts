/**
 * Перевод типичных сообщений бэкенда/HTTP в операционный текст для UI.
 * Исходный текст при необходимости логируется вызывающим кодом.
 */
export function mapTicketActionError(raw: string | null | undefined): string {
  const t = (raw || '').trim()
  if (!t) return 'Операция не выполнена. Попробуйте ещё раз или обновите страницу.'

  const low = t.toLowerCase()

  if (low.includes('forbidden') || t.includes('Недостаточно прав') || t.includes('недостаточно прав')) {
    return 'Недостаточно прав для этого действия.'
  }
  if (low.includes('not found') || t.includes('не найден')) {
    return 'Заявка не найдена или недоступна в текущем контуре.'
  }
  if (t.includes('Ticket not available for claim') || low.includes('not available for claim')) {
    return 'Взять эту заявку сейчас нельзя: проверьте статус, назначение и доступ к точке.'
  }
  if (t.includes('Invalid specialization') || low.includes('specialization')) {
    return 'Вы не можете взять эту заявку: категория не входит в ваши специализации.'
  }
  if (t.includes('Technician is not bound to ticket location') || t.includes('Локация заявки недоступна')) {
    return 'Нет доступа к точке этой заявки в вашем профиле.'
  }
  if (t.includes('Cannot complete ticket without at least 1 work report photo') || low.includes('work report photo')) {
    return 'Чтобы завершить заявку, добавьте хотя бы одно фото или видео отчёта.'
  }
  if (t.includes('Cannot complete ticket without at least 1 comment') || (low.includes('comment') && low.includes('complete'))) {
    return 'Чтобы завершить заявку, добавьте комментарий по выполнению.'
  }
  if (t.includes('Client company cannot perform executor operations')) {
    return 'В роли клиента это действие недоступно.'
  }
  if (t.includes('Same status transition')) {
    return 'Статус уже установлен.'
  }
  if (low.includes('invalid status transition')) {
    return 'Такой переход статуса сейчас недоступен.'
  }
  if (t.includes('comment is required') || t.includes('comment cannot be empty')) {
    return 'Нужен комментарий.'
  }
  if (t.includes('Some attachmentIds are invalid')) {
    return 'Фото устарело для текущего контекста. Загрузите снимок заново.'
  }

  if (t.length > 220) {
    return `${t.slice(0, 217)}…`
  }
  return t
}

export function logTicketActionError(scope: string, raw: unknown) {
  const msg = raw instanceof Error ? raw.message : String(raw)
  // eslint-disable-next-line no-console
  console.warn(`[ticket_action][${scope}]`, msg)
}
