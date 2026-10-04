export type MaterialDirectoryItem = {
  id: string
  name: string
  unit: string
  sku?: string | null
  category?: string | null
  active?: boolean
}

export type MaterialDecimal = string | number

export type TechnicianMaterialBalance = {
  materialId: string
  materialName: string
  unit: string
  balance: MaterialDecimal
}

export type MaterialMovementType = 'PURCHASE' | 'USAGE' | 'ISSUE' | 'RECEIPT' | 'ADJUSTMENT' | string

export type MaterialMovement = {
  id: string
  materialId: string
  materialName: string
  unit: string
  quantity: MaterialDecimal
  type: MaterialMovementType
  createdAt: string
  ticketId?: string | null
  ticketNumber?: number | null
  actorName?: string | null
  fromName?: string | null
  toName?: string | null
  comment?: string | null
  cost?: string | null
}

export type TicketMaterialUsage = {
  id: string
  materialId: string
  materialName: string
  unit: string
  quantity: MaterialDecimal
  createdAt: string
  technicianName?: string | null
  comment?: string | null
}

export type SelfPurchaseInput = {
  materialId: string
  quantity: string
  cost?: string | null
  comment?: string | null
}

export type TicketMaterialUsageInput = {
  materialId: string
  quantity: string
  comment?: string | null
}

export type ManagerIssueMaterialInput = {
  materialId: string
  quantity: string
  comment?: string | null
}

export type StockReceiptInput = {
  materialId: string
  quantity: string
  comment?: string | null
}

export type CreateMaterialInput = {
  name: string
  unit: string
  sku?: string | null
  category?: string | null
  active?: boolean
}

export type UpdateMaterialInput = Partial<CreateMaterialInput>

export type MaterialOperationResult = {
  id?: string
  materialId?: string
  materialName?: string
  unit?: string
  quantity?: MaterialDecimal
  updatedStockBalance?: MaterialDecimal | null
  updatedTechnicianBalance?: MaterialDecimal | null
  createdAt?: string
}

export function normalizeMaterialText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function decimalString(value: MaterialDecimal | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return value.trim().replace(',', '.')
}

export function materialQuantityNumber(value: MaterialDecimal | null | undefined): number {
  const normalized = decimalString(value)
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function formatMaterialQuantity(quantity: MaterialDecimal, unit: string): string {
  const amount = materialQuantityNumber(quantity)
  const safeQuantity = Number.isFinite(amount) ? amount : 0
  return `${safeQuantity.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} ${unit || ''}`.trim()
}

export function materialBalanceLabel(balance: TechnicianMaterialBalance): string {
  return formatMaterialQuantity(balance.balance, balance.unit)
}

export function activeMaterials(materials: MaterialDirectoryItem[]): MaterialDirectoryItem[] {
  return materials.filter((item) => item.active !== false)
}

export function findMaterialBalance(
  balances: TechnicianMaterialBalance[],
  materialId: string,
): TechnicianMaterialBalance | null {
  return balances.find((item) => item.materialId === materialId) || null
}

function positiveQuantityError(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Количество должно быть больше 0'
  return null
}

export function validatePositiveDecimalQuantity(quantity: MaterialDecimal): string | null {
  return positiveQuantityError(materialQuantityNumber(quantity))
}

export function validateSelfPurchaseInput(input: SelfPurchaseInput): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  const quantityError = validatePositiveDecimalQuantity(input.quantity)
  if (quantityError) return quantityError
  const cost = decimalString(input.cost)
  if (cost && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
    return 'Стоимость не может быть отрицательной'
  }
  return null
}

export function validateTicketMaterialUsageInput(
  input: TicketMaterialUsageInput,
  balances: TechnicianMaterialBalance[],
): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  const quantityError = validatePositiveDecimalQuantity(input.quantity)
  if (quantityError) return quantityError

  const balance = findMaterialBalance(balances, input.materialId)
  if (!balance) return 'Материал отсутствует в текущих остатках'
  if (materialQuantityNumber(input.quantity) > materialQuantityNumber(balance.balance)) {
    return `Доступно только ${materialBalanceLabel(balance)}`
  }
  return null
}

export function validateManagerIssueMaterialInput(input: ManagerIssueMaterialInput): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  return validatePositiveDecimalQuantity(input.quantity)
}

export function validateStockReceiptInput(input: StockReceiptInput): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  return validatePositiveDecimalQuantity(input.quantity)
}

export function validateCreateMaterialInput(input: CreateMaterialInput): string | null {
  if (normalizeMaterialText(input.name).length < 2) return 'Название: минимум 2 символа'
  if (!normalizeMaterialText(input.unit)) return 'Укажите единицу измерения'
  return null
}

export function movementTypeLabel(type: MaterialMovementType): string {
  switch (type) {
    case 'PURCHASE':
      return 'Покупка'
    case 'USAGE':
      return 'Списано в заявку'
    case 'ISSUE':
      return 'Выдано'
    case 'RECEIPT':
      return 'Поступление'
    case 'ADJUSTMENT':
      return 'Корректировка'
    default:
      return type
  }
}
