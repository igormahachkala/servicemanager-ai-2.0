import type { Role } from './api'
import type { MaterialBalance } from './materials'
import { formatMaterialQuantity, materialUnit, normalizeDecimalInput } from './materials'

export type MaterialUsageDraft = { materialId: string; quantity: string; comment: string }

export const EMPTY_MATERIAL_USAGE_DRAFT: MaterialUsageDraft = {
  materialId: '',
  quantity: '',
  comment: '',
}

export type MaterialUsageValidation =
  | { ok: true; payload: { materialId: string; quantity: string; comment?: string } }
  | {
      ok: false
      reason: 'no-material' | 'unknown-material' | 'no-quantity' | 'not-positive' | 'over-balance'
      message: string
    }

export function validateMaterialUsage(
  draft: MaterialUsageDraft,
  balances: readonly MaterialBalance[],
): MaterialUsageValidation {
  const materialId = draft.materialId.trim()
  if (!materialId) return { ok: false, reason: 'no-material', message: 'Выберите материал' }
  const balance = balances.find((item) => item.materialId === materialId)
  if (!balance) {
    return { ok: false, reason: 'unknown-material', message: 'Этого материала нет у вас на руках' }
  }
  if (!draft.quantity.trim()) return { ok: false, reason: 'no-quantity', message: 'Укажите количество' }
  const quantity = normalizeDecimalInput(draft.quantity)
  if (!quantity || Number(quantity) <= 0) {
    return { ok: false, reason: 'not-positive', message: 'Количество должно быть больше нуля' }
  }
  if (Number(quantity) > Number(balance.quantity)) {
    return {
      ok: false,
      reason: 'over-balance',
      message: `Доступно ${formatMaterialQuantity(balance.quantity, materialUnit(balance.material))}`,
    }
  }
  const comment = draft.comment.trim()
  return { ok: true, payload: { materialId, quantity, ...(comment ? { comment } : {}) } }
}

export function canConsumeMaterials(role: Role | null | undefined): boolean {
  return role === 'TECHNICIAN'
}

export function selectableBalances(balances: readonly MaterialBalance[] | null | undefined): MaterialBalance[] {
  return (balances ?? []).filter((item) => Number(item.quantity) > 0)
}

export function maxQuantityFor(materialId: string, balances: readonly MaterialBalance[]): string | undefined {
  return balances.find((item) => item.materialId === materialId)?.quantity
}
