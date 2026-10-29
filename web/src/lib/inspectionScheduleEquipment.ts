/** Form consistency only. Equipment access is still checked by the existing backend. */
export type InspectionScheduleScope = {
  clientCompanyId: string
  locationId: string
  equipmentId: string
}

type ScopeAction = { type: 'client' | 'location' | 'equipment'; value: string }

/** Changing either parent context clears its dependent selection in the same state update. */
export function inspectionScheduleScopeReducer(
  state: InspectionScheduleScope,
  action: ScopeAction,
): InspectionScheduleScope {
  switch (action.type) {
    case 'client':
      return { clientCompanyId: action.value, locationId: '', equipmentId: '' }
    case 'location':
      return { ...state, locationId: action.value, equipmentId: '' }
    case 'equipment':
      return { ...state, equipmentId: state.locationId ? action.value : '' }
  }
}

export type ScheduleEquipmentOption = {
  id: string
  name: string
  model?: string | null
  type?: string | null
  locationId?: string
  companyId?: string
}

export type ScheduleEquipmentSnapshot = {
  clientCompanyId: string
  locationId: string
  items: readonly ScheduleEquipmentOption[]
}

/**
 * No selection preserves the site-wide payload, even when equipment could not load.
 * A selection must belong to the current successful query, not a previous client/site.
 * The caller withholds the snapshot while loading, refreshing or after a query error.
 */
export function inspectionScheduleEquipmentPayload(
  scope: InspectionScheduleScope,
  snapshot?: ScheduleEquipmentSnapshot,
): { equipmentId?: string } {
  if (!scope.equipmentId) return {}
  if (
    !scope.locationId
    || !snapshot
    || snapshot.clientCompanyId !== scope.clientCompanyId
    || snapshot.locationId !== scope.locationId
  ) {
    throw new Error('Дождитесь загрузки оборудования выбранной точки или выберите «Вся точка»')
  }

  const selected = snapshot.items.find((item) => item.id === scope.equipmentId)
  if (
    !selected
    || (selected.locationId && selected.locationId !== scope.locationId)
    || (scope.clientCompanyId && selected.companyId && selected.companyId !== scope.clientCompanyId)
  ) {
    throw new Error('Выбранное оборудование больше недоступно для этой точки. Выберите оборудование заново или «Вся точка»')
  }
  return { equipmentId: selected.id }
}

export function inspectionScheduleEquipmentLabel(item: {
  name: string
  model?: string | null
  type?: string | null
}): string {
  const name = item.name.trim() || 'Оборудование без названия'
  const detail = item.model?.trim() || item.type?.trim()
  return detail && detail !== name ? `${name} · ${detail}` : name
}
