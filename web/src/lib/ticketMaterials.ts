import type * as api from './api'

/**
 * SMA-MATERIALS-V0-TICKET-USAGE.
 *
 * Решения блока «Материалы» в карточке заявки: что показать и можно ли
 * списать. Ни React, ни сети здесь нет — окружение тестов node, и правила
 * должны проверяться исполнением, а не через разметку.
 *
 * Границы среза: только списание на заявку из того, что уже на руках
 * у техника. Закупок, выдачи, склада, поставщиков, возмещений и стоимости
 * здесь нет и быть не должно.
 */

/** Остаток материала на руках у техника. Приходит с сервера, руками не меняется. */
export type TechnicianMaterialBalance = {
  materialId: string
  name: string
  unit: string
  /** Количество строкой: Decimal с сервера, дробные единицы допустимы (м, л). */
  available: string
}

/** Строка истории: материал, списанный на эту заявку. */
export type TicketMaterialUsage = {
  id: string
  ticketId: string
  materialId: string
  name: string
  unit: string
  quantity: string
  usedAt: string
  usedBy?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email: string
  } | null
  comment?: string | null
}

/**
 * Количество разбирается из строки ввода.
 *
 * Запятая принимается наравне с точкой: русская раскладка и мобильная
 * клавиатура дают именно запятую, и отвергать её значило бы ругаться
 * на корректный ввод.
 */
export function parseQuantity(raw: string): number | null {
  const normalized = (raw ?? '').trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d*\.?\d+$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Остаток с сервера — тоже строка; нечитаемое значение трактуется как ноль. */
export function parseAvailable(raw: string | null | undefined): number {
  const value = parseQuantity(raw ?? '')
  return value === null ? 0 : value
}

export type MaterialUsageDraft = {
  materialId: string
  quantity: string
  comment: string
}

export const EMPTY_MATERIAL_USAGE_DRAFT: MaterialUsageDraft = {
  materialId: '',
  quantity: '',
  comment: '',
}

export type MaterialUsageValidation =
  | { ok: true; payload: { materialId: string; quantity: string; comment?: string } }
  | { ok: false; reason: MaterialUsageDenialReason; message: string }

export type MaterialUsageDenialReason =
  | 'no-material'
  | 'unknown-material'
  | 'no-quantity'
  | 'not-positive'
  | 'over-balance'

/**
 * Можно ли списать черновик.
 *
 * Отказ возвращается причиной, а не только текстом: текст нужен человеку,
 * причина — тесту и вызывающему коду. Проверка материала идёт по остаткам
 * техника, поэтому списать то, чего у него нет, нельзя даже подставив id.
 */
export function validateMaterialUsage(
  draft: MaterialUsageDraft,
  balances: readonly TechnicianMaterialBalance[],
): MaterialUsageValidation {
  const materialId = (draft.materialId ?? '').trim()
  if (!materialId) {
    return { ok: false, reason: 'no-material', message: 'Выберите материал' }
  }

  const balance = balances.find((item) => item.materialId === materialId)
  if (!balance) {
    return {
      ok: false,
      reason: 'unknown-material',
      message: 'Этого материала нет у вас на руках',
    }
  }

  const raw = (draft.quantity ?? '').trim()
  if (!raw) {
    return { ok: false, reason: 'no-quantity', message: 'Укажите количество' }
  }

  const quantity = parseQuantity(raw)
  if (quantity === null || quantity <= 0) {
    return {
      ok: false,
      reason: 'not-positive',
      message: 'Количество должно быть больше нуля',
    }
  }

  const available = parseAvailable(balance.available)
  if (quantity > available) {
    return {
      ok: false,
      reason: 'over-balance',
      message: `Доступно ${formatQuantity(balance.available)} ${balance.unit}`,
    }
  }

  const comment = (draft.comment ?? '').trim()
  return {
    ok: true,
    payload: {
      materialId,
      // Отправляется нормализованная строка: сервер хранит Decimal.
      quantity: String(quantity),
      ...(comment ? { comment } : {}),
    },
  }
}

/** Количество без хвостовых нулей: «7», «2.5», а не «7.000». */
export function formatQuantity(raw: string | null | undefined): string {
  const value = parseQuantity(raw ?? '')
  if (value === null) return '0'
  return String(value)
}

/** Подпись строки истории: «Кабель ВВГ 3×2.5 — 7 м». */
export function formatUsageLine(usage: Pick<TicketMaterialUsage, 'name' | 'quantity' | 'unit'>): string {
  return `${usage.name} — ${formatQuantity(usage.quantity)} ${usage.unit}`.trim()
}

/**
 * Можно ли списывать материалы.
 *
 * Списывает тот, у кого они на руках, — техник. Остальные роли блок видят,
 * но только читают. Это подсказка интерфейса, а не разрешение: право
 * решает бэкенд, и скрытая кнопка никого не пускает.
 */
export function canConsumeMaterials(role: api.Role | null | undefined): boolean {
  return role === 'TECHNICIAN'
}

/** Остатки, из которых есть что списывать: нулевые в выбор не попадают. */
export function selectableBalances(
  balances: readonly TechnicianMaterialBalance[] | null | undefined,
): TechnicianMaterialBalance[] {
  return (balances ?? []).filter((item) => parseAvailable(item.available) > 0)
}

/**
 * Верхняя граница для поля ввода.
 *
 * Интерфейс не должен позволять набрать больше доступного, поэтому значение
 * уходит в атрибут max. Это удобство, а не защита: проверка остатка всё
 * равно выполняется и здесь, и на сервере.
 */
export function maxQuantityFor(
  materialId: string,
  balances: readonly TechnicianMaterialBalance[],
): string | undefined {
  const balance = balances.find((item) => item.materialId === materialId)
  if (!balance) return undefined
  return formatQuantity(balance.available)
}
