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

export type MaterialActor = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
} | null

/** Позиция канонического справочника: из неё выбирают при покупке. */
export type MaterialCatalogItem = {
  id: string
  name: string
  unit: string
  isActive?: boolean
}

/** Строка истории: материал, списанный на заявку. */
export type MaterialConsumption = {
  id: string
  ticketId: string
  materialId: string
  name: string
  unit: string
  quantity: string
  /** Имена даты расходятся между ручками, поэтому принимаются оба. */
  consumedAt?: string
  createdAt?: string
  usedBy?: MaterialActor
  actor?: MaterialActor
  comment?: string | null
}

/**
 * Вид движения.
 *
 * Три известны точно: выдача, покупка, списание. Прочие значения бэкенд
 * может добавить позже, поэтому тип открыт, а подпись для незнакомого вида
 * берётся из самого значения — экран не ломается на новом виде.
 */
export type MaterialMovementKind = 'ISSUE' | 'PURCHASE' | 'CONSUMPTION' | (string & {})

export type MaterialMovement = {
  id: string
  materialId: string
  name: string
  unit: string
  /** Знак несёт направление: выдача и покупка прибавляют, списание убавляет. */
  quantity: string
  kind: MaterialMovementKind
  type?: MaterialMovementKind
  createdAt?: string
  occurredAt?: string
  ticketId?: string | null
  ticketNumber?: number | null
  comment?: string | null
  actor?: MaterialActor
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
export function formatUsageLine(usage: Pick<MaterialConsumption, 'name' | 'quantity' | 'unit'>): string {
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


/* ─────────── движения: выдача / покупка / списание ─────────── */

const MOVEMENT_LABELS_RU: Record<string, string> = {
  ISSUE: 'Выдача',
  PURCHASE: 'Покупка',
  CONSUMPTION: 'Списание',
}

/** Вид движения: имя поля у ручки может быть kind или type. */
export function movementKind(movement: Pick<MaterialMovement, 'kind' | 'type'>): string {
  return (movement.kind || movement.type || '').trim()
}

/**
 * Подпись движения.
 *
 * Списание называет заявку, если её номер пришёл: «Списание на заявку #1045».
 * Незнакомый вид не ломает экран — показывается как есть, потому что бэкенд
 * вправе добавить вид, о котором этот срез не знает.
 */
export function movementLabel(movement: MaterialMovement): string {
  const kind = movementKind(movement)
  const base = MOVEMENT_LABELS_RU[kind] || kind || 'Движение'
  if (kind === 'CONSUMPTION' && movement.ticketNumber) {
    return `${base} на заявку #${movement.ticketNumber}`
  }
  return base
}

/**
 * Величина движения без знака.
 *
 * Отдельно от parseQuantity: тот намеренно не принимает отрицательные
 * (количество к списанию отрицательным быть не может), а ручка движений
 * вправе отдать расход со минусом. Здесь нужна именно величина.
 */
export function movementMagnitude(raw: string | null | undefined): number {
  const normalized = (raw ?? '').trim().replace(',', '.').replace(/^[-\u2212+]/, '')
  const value = parseQuantity(normalized)
  return value === null ? 0 : value
}

/**
 * Количество движения со знаком.
 *
 * Знак берётся из вида, а не из знака числа: ручка может отдать списание
 * и положительным, и отрицательным, а читателю нужно видеть направление.
 * Двойного минуса при этом не возникает.
 */
export function movementSignedQuantity(movement: MaterialMovement): string {
  const magnitude = movementMagnitude(movement.quantity)
  if (magnitude === 0) return `0 ${movement.unit}`.trim()
  const negative = movementKind(movement) === 'CONSUMPTION'
  const sign = negative ? '\u2212' : '+'
  return `${sign}${formatQuantity(String(magnitude))} ${movement.unit}`.trim()
}

/** Направление движения — для визуального различения видов. */
export function movementDirection(movement: MaterialMovement): 'in' | 'out' {
  return movementKind(movement) === 'CONSUMPTION' ? 'out' : 'in'
}

/* ─────────── самостоятельная покупка ─────────── */

export type MaterialPurchaseDraft = {
  materialId: string
  quantity: string
  unitPrice: string
  totalPrice: string
  comment: string
}

export const EMPTY_MATERIAL_PURCHASE_DRAFT: MaterialPurchaseDraft = {
  materialId: '',
  quantity: '',
  unitPrice: '',
  totalPrice: '',
  comment: '',
}

export type MaterialPurchaseValidation =
  | {
      ok: true
      payload: {
        materialId: string
        quantity: string
        unitPrice?: string
        totalPrice?: string
        comment?: string
      }
    }
  | { ok: false; reason: 'no-material' | 'no-quantity' | 'not-positive'; message: string }

/**
 * Можно ли записать покупку.
 *
 * Остатком покупка не ограничена — это приход. Материал берётся из
 * канонического справочника: своего названия техник не придумывает,
 * иначе один и тот же кабель разошёлся бы на десять написаний.
 */
export function validateMaterialPurchase(
  draft: MaterialPurchaseDraft,
  catalog: readonly MaterialCatalogItem[],
): MaterialPurchaseValidation {
  const materialId = (draft.materialId ?? '').trim()
  if (!materialId) {
    return { ok: false, reason: 'no-material', message: 'Выберите материал' }
  }
  if (!catalog.some((item) => item.id === materialId)) {
    return { ok: false, reason: 'no-material', message: 'Выберите материал из справочника' }
  }

  const raw = (draft.quantity ?? '').trim()
  if (!raw) {
    return { ok: false, reason: 'no-quantity', message: 'Укажите количество' }
  }

  const quantity = parseQuantity(raw)
  if (quantity === null || quantity <= 0) {
    return { ok: false, reason: 'not-positive', message: 'Количество должно быть больше нуля' }
  }

  const unitPrice = parseQuantity(draft.unitPrice ?? '')
  const totalPrice = parseQuantity(draft.totalPrice ?? '')
  const comment = (draft.comment ?? '').trim()

  return {
    ok: true,
    payload: {
      materialId,
      quantity: String(quantity),
      ...(unitPrice !== null && unitPrice > 0 ? { unitPrice: String(unitPrice) } : {}),
      ...(totalPrice !== null && totalPrice > 0 ? { totalPrice: String(totalPrice) } : {}),
      ...(comment ? { comment } : {}),
    },
  }
}

/** Активные позиции справочника; флага нет — позиция считается активной. */
export function purchasableCatalog(
  catalog: readonly MaterialCatalogItem[] | null | undefined,
): MaterialCatalogItem[] {
  return (catalog ?? []).filter((item) => item.isActive !== false)
}

/** Остатки для экрана «Мои материалы»: нулевые полезным запасом не являются. */
export function visibleBalances(
  balances: readonly TechnicianMaterialBalance[] | null | undefined,
): TechnicianMaterialBalance[] {
  return selectableBalances(balances)
}
