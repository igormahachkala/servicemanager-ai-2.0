import type {
  CompanyStockBalance,
  CreateMaterialInput,
  IssueMaterialInput,
  MaterialMovement,
  MaterialMovementKind,
  TechnicianMaterialBalance,
} from './api'

/**
 * SMA-MATERIALS-V0 — чистая логика раздела материалов.
 *
 * Окружение тестов node: компонент не отрисовать, поэтому всё, что можно
 * проверить без разметки — валидация форм, классификация движений, формат
 * остатков, — вынесено сюда. Компоненты эти функции вызывают и своей
 * арифметики не заводят.
 */

/** Человекочитаемый формат остатка: «Кабель — 13 м». */
export function formatBalance(balance: Pick<TechnicianMaterialBalance, 'materialName' | 'quantity' | 'unit'>): string {
  return `${balance.materialName} — ${formatQuantity(balance.quantity)} ${balance.unit}`.trim()
}

/** Количество без лишних нулей: 13, 13.5, но не 13.50 и не 13.0. */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0'
  const rounded = Math.round(quantity * 1000) / 1000
  return String(rounded)
}

/**
 * Знаковое движение для истории: «+20 м», «−7 м».
 *
 * Знак берётся по количеству, которое присылает backend (приход > 0,
 * расход < 0), а не по виду: вид отвечает за подпись и цвет, число — за знак.
 */
export function formatMovementAmount(movement: Pick<MaterialMovement, 'quantity' | 'unit'>): string {
  const q = movement.quantity
  const sign = q > 0 ? '+' : q < 0 ? '−' : ''
  return `${sign}${formatQuantity(Math.abs(q))} ${movement.unit}`.trim()
}

export type MovementVisual = {
  /** Тон для визуального различия прихода и расхода. */
  tone: 'positive' | 'negative' | 'neutral'
  /** Подпись источника движения. */
  label: string
}

/**
 * Визуальное различие видов движения — требование V0: выдача, покупка и
 * расход по заявке должны отличаться на глаз. Выдача и покупка — приход
 * (positive), расход по заявке — убыль (negative).
 */
export function describeMovement(
  movement: Pick<MaterialMovement, 'kind' | 'ticketNumber'>,
): MovementVisual {
  switch (movement.kind) {
    case 'ISSUE':
      return { tone: 'positive', label: 'выдано руководителем' }
    case 'PURCHASE':
      return { tone: 'positive', label: 'куплено техником' }
    case 'CONSUMPTION':
      return {
        tone: 'negative',
        label: movement.ticketNumber ? `заявка #${movement.ticketNumber}` : 'расход по заявке',
      }
    default:
      return { tone: 'neutral', label: String((movement as { kind?: string }).kind ?? '') }
  }
}

export const MOVEMENT_KIND_LABELS: Record<MaterialMovementKind, string> = {
  ISSUE: 'выдано руководителем',
  PURCHASE: 'куплено техником',
  CONSUMPTION: 'расход по заявке',
}

export type ValidationResult = { ok: true } | { ok: false; error: string }

/** Валидация формы создания/редактирования материала. */
export function validateMaterialInput(input: Partial<CreateMaterialInput>): ValidationResult {
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Укажите название материала' }
  const unit = (input.unit ?? '').trim()
  if (!unit) return { ok: false, error: 'Укажите единицу измерения' }
  return { ok: true }
}

/**
 * Валидация выдачи. Количество строго положительное: выдать 0 или
 * отрицательное нельзя. Складской остаток здесь не проверяется — это
 * решает backend; UI не притворяется, что знает COMPANY_STOCK достоверно.
 */
export function validateIssueInput(input: Partial<IssueMaterialInput>): ValidationResult {
  if (!input.materialId) return { ok: false, error: 'Выберите материал' }
  const q = Number(input.quantity)
  if (!Number.isFinite(q)) return { ok: false, error: 'Укажите количество' }
  if (q <= 0) return { ok: false, error: 'Количество должно быть больше нуля' }
  return { ok: true }
}

/**
 * Подсказка по складскому остатку, если backend его дал. UI не блокирует
 * выдачу на основании этого числа — недостаток ловит backend и возвращает
 * ошибку. Здесь только предупреждение для руководителя.
 */
export function stockHint(
  stock: CompanyStockBalance | null | undefined,
  requested: number,
): { available: number | null; insufficient: boolean } {
  if (!stock) return { available: null, insufficient: false }
  return { available: stock.quantity, insufficient: Number.isFinite(requested) && requested > stock.quantity }
}

/** Активные материалы для выпадающего списка выдачи: неактивные выдавать нельзя. */
export function selectableMaterials<T extends { isActive: boolean }>(items: ReadonlyArray<T>): T[] {
  return items.filter((m) => m.isActive)
}
