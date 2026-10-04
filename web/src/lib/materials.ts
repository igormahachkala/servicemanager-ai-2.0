export type MaterialHolderType = 'COMPANY_STOCK' | 'TECHNICIAN'

export type MaterialMovementType =
  | 'PURCHASE'
  | 'ISSUE'
  | 'CONSUMPTION'
  | 'RETURN'
  | 'TRANSFER'
  | 'ADJUSTMENT_PLUS'
  | 'ADJUSTMENT_MINUS'

export type Material = {
  id: string
  companyId: string
  name: string
  unit: string
  sku: string | null
  category: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type MaterialBalance = {
  id: string
  companyId: string
  materialId: string
  holderType: MaterialHolderType
  holderUserId: string | null
  quantity: string
  updatedAt: string
  material?: Material
}

export type MaterialUserSummary = {
  id: string
  firstName?: string | null
  lastName?: string | null
  role?: string
}

export type MaterialMovement = {
  id: string
  companyId: string
  materialId: string
  type: MaterialMovementType
  quantity: string
  fromHolderType: MaterialHolderType | null
  fromUserId: string | null
  toHolderType: MaterialHolderType | null
  toUserId: string | null
  ticketId: string | null
  actorUserId: string
  unitPrice: string | null
  totalAmount: string | null
  comment: string | null
  createdAt: string
  material?: Material
  actor?: MaterialUserSummary
  fromUser?: MaterialUserSummary
  toUser?: MaterialUserSummary
  ticket?: { id: string; ticketNumber: number }
}

export type CreateMaterialInput = {
  name: string
  unit: string
  sku?: string | null
  category?: string | null
}

export type UpdateMaterialInput = Partial<CreateMaterialInput> & { active?: boolean }
export type StockReceiptInput = { materialId: string; quantity: string; comment?: string }
export type IssueMaterialInput = StockReceiptInput & { technicianId: string }
export type PurchaseMaterialInput = StockReceiptInput & {
  unitPrice?: string
  totalAmount?: string
}
export type ConsumeMaterialInput = StockReceiptInput & {
  ticketId: string
  linkedClientCompanyId?: string
}

export type MaterialMutationResult = {
  balance: MaterialBalance
  movement: MaterialMovement
}

export type MaterialIssueResult = {
  stock: MaterialBalance
  technicianBalance: MaterialBalance
  movement: MaterialMovement
}

export type ValidationResult = { ok: true } | { ok: false; error: string }

export function parseMaterialQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized || !/^\d*\.?\d+$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function normalizeDecimalInput(raw: string): string | null {
  const value = parseMaterialQuantity(raw)
  return value === null ? null : String(value)
}

export function formatMaterialQuantity(quantity: string, unit = ''): string {
  const value = Number(quantity)
  const formatted = Number.isFinite(value)
    ? value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })
    : quantity
  return `${formatted} ${unit}`.trim()
}

export function materialName(material?: Material): string {
  return material?.name || 'Материал'
}

export function materialUnit(material?: Material): string {
  return material?.unit || ''
}

export function materialUserName(user?: MaterialUserSummary): string {
  if (!user) return ''
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
}

export function movementTypeLabel(type: MaterialMovementType): string {
  const labels: Record<MaterialMovementType, string> = {
    PURCHASE: 'Покупка',
    ISSUE: 'Выдано',
    CONSUMPTION: 'Списано в заявку',
    RETURN: 'Возврат',
    TRANSFER: 'Перемещение',
    ADJUSTMENT_PLUS: 'Поступление',
    ADJUSTMENT_MINUS: 'Корректировка расхода',
  }
  return labels[type]
}

export function activeMaterials(materials: readonly Material[]): Material[] {
  return materials.filter((item) => item.active)
}

export function positiveQuantityValidation(raw: string): ValidationResult {
  const value = parseMaterialQuantity(raw)
  if (value === null || value <= 0) {
    return { ok: false, error: 'Количество должно быть больше нуля' }
  }
  return { ok: true }
}

export function validateMaterialInput(input: Partial<CreateMaterialInput>): ValidationResult {
  if (!(input.name ?? '').trim()) return { ok: false, error: 'Укажите название материала' }
  if (!(input.unit ?? '').trim()) return { ok: false, error: 'Укажите единицу измерения' }
  return { ok: true }
}

export function validatePurchaseInput(input: {
  materialId: string
  quantity: string
  unitPrice?: string
  totalAmount?: string
}): ValidationResult {
  if (!input.materialId) return { ok: false, error: 'Выберите материал' }
  const quantity = positiveQuantityValidation(input.quantity)
  if (!quantity.ok) return quantity
  for (const value of [input.unitPrice, input.totalAmount]) {
    if (value && (parseMaterialQuantity(value) === null || Number(value.replace(',', '.')) < 0)) {
      return { ok: false, error: 'Стоимость должна быть неотрицательной' }
    }
  }
  return { ok: true }
}

export function validateIssueInput(input: { materialId: string; quantity: string }): ValidationResult {
  if (!input.materialId) return { ok: false, error: 'Выберите материал' }
  return positiveQuantityValidation(input.quantity)
}

export function validateConsumptionInput(
  input: { materialId: string; quantity: string },
  balances: readonly MaterialBalance[],
): ValidationResult {
  if (!input.materialId) return { ok: false, error: 'Выберите материал' }
  const quantity = positiveQuantityValidation(input.quantity)
  if (!quantity.ok) return quantity
  const balance = balances.find((item) => item.materialId === input.materialId)
  if (!balance) return { ok: false, error: 'Материала нет в текущих остатках' }
  if (Number(input.quantity.replace(',', '.')) > Number(balance.quantity)) {
    return {
      ok: false,
      error: `Доступно ${formatMaterialQuantity(balance.quantity, materialUnit(balance.material))}`,
    }
  }
  return { ok: true }
}
