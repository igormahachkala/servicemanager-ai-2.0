export type MaterialDirectoryItem = {
  id: string
  name: string
  unit: string
  sku?: string | null
  category?: string | null
  active?: boolean
}

export type TechnicianMaterialBalance = {
  materialId: string
  materialName: string
  unit: string
  balance: number
}

export type MaterialMovementType = 'PURCHASE' | 'USAGE' | 'ISSUE' | 'ADJUSTMENT'

export type MaterialMovement = {
  id: string
  materialId: string
  materialName: string
  unit: string
  quantity: number
  type: MaterialMovementType
  createdAt: string
  ticketId?: string | null
  ticketNumber?: number | null
  actorName?: string | null
  comment?: string | null
  cost?: number | null
}

export type TicketMaterialUsage = {
  id: string
  materialId: string
  materialName: string
  unit: string
  quantity: number
  createdAt: string
  technicianName?: string | null
  comment?: string | null
}

export type SelfPurchaseInput = {
  materialId: string
  quantity: number
  cost?: number | null
  comment?: string | null
  receiptAttachmentId?: string | null
}

export type TicketMaterialUsageInput = {
  materialId: string
  quantity: number
  comment?: string | null
}

export type ManagerIssueMaterialInput = {
  materialId: string
  quantity: number
  comment?: string | null
}

export type CreateMaterialInput = {
  name: string
  unit: string
  sku?: string | null
  category?: string | null
  active?: boolean
}

export function normalizeMaterialText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function formatMaterialQuantity(quantity: number, unit: string): string {
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0
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

export function validateSelfPurchaseInput(input: SelfPurchaseInput): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  const quantityError = positiveQuantityError(input.quantity)
  if (quantityError) return quantityError
  if (input.cost != null && (!Number.isFinite(input.cost) || input.cost < 0)) {
    return 'Стоимость не может быть отрицательной'
  }
  return null
}

export function validateTicketMaterialUsageInput(
  input: TicketMaterialUsageInput,
  balances: TechnicianMaterialBalance[],
): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  const quantityError = positiveQuantityError(input.quantity)
  if (quantityError) return quantityError

  const balance = findMaterialBalance(balances, input.materialId)
  if (!balance) return 'Материал отсутствует в текущих остатках'
  if (input.quantity > balance.balance) {
    return `Доступно только ${materialBalanceLabel(balance)}`
  }
  return null
}

export function validateManagerIssueMaterialInput(input: ManagerIssueMaterialInput): string | null {
  if (!input.materialId.trim()) return 'Выберите материал'
  return positiveQuantityError(input.quantity)
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
    case 'ADJUSTMENT':
      return 'Корректировка'
    default:
      return type
  }
}
