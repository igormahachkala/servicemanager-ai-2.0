import type {
  InspectionRunItem,
  InspectionRunItemStatus,
  InspectionRunStatus,
  UpdateInspectionRunItemInput,
} from '../lib/api'

export type EditableCheckpointStatus = Extract<InspectionRunItemStatus, 'OK' | 'ISSUE' | 'CRITICAL'>

export type CheckpointEditorDraft = {
  status: EditableCheckpointStatus | null
  comment: string
  booleanValue: '' | 'true' | 'false'
  numberValue: string
  textValue: string
}

export const EDITABLE_CHECKPOINT_STATUSES: Array<{
  value: EditableCheckpointStatus
  label: string
}> = [
  { value: 'OK', label: 'Норма' },
  { value: 'ISSUE', label: 'Проблема' },
  { value: 'CRITICAL', label: 'Критично' },
]

export const CHECKPOINT_STATE_LABELS: Record<InspectionRunItemStatus, string> = {
  PENDING: 'Не заполнено',
  OK: 'Норма',
  ISSUE: 'Проблема',
  CRITICAL: 'Критично',
  SKIPPED: 'Не заполнено',
}

export function checkpointStateLabel(status: InspectionRunItemStatus): string {
  return CHECKPOINT_STATE_LABELS[status]
}

export function checkpointStatusOptions(
  selected: EditableCheckpointStatus | null,
): typeof EDITABLE_CHECKPOINT_STATUSES {
  // The selected action remains visible so a technician can understand and
  // re-save the current answer without first switching through another state.
  void selected
  return EDITABLE_CHECKPOINT_STATUSES
}

export function checkpointDraftFromItem(item: InspectionRunItem): CheckpointEditorDraft {
  const status = EDITABLE_CHECKPOINT_STATUSES.some((option) => option.value === item.status)
    ? (item.status as EditableCheckpointStatus)
    : null

  return {
    status,
    comment: item.comment ?? '',
    booleanValue:
      item.booleanValue === true ? 'true' : item.booleanValue === false ? 'false' : '',
    numberValue:
      item.numberValue === null || item.numberValue === undefined ? '' : String(item.numberValue),
    textValue: item.textValue ?? '',
  }
}

export function canEditCheckpoint(runStatus: InspectionRunStatus): boolean {
  return runStatus === 'IN_PROGRESS'
}

export type CompleteCheckpointPayloadResult =
  | { ok: true; payload: UpdateInspectionRunItemInput }
  | { ok: false; message: string }

export function checkpointPayloadForOfflineQueue(
  payload: UpdateInspectionRunItemInput,
): Record<string, unknown> {
  return { ...payload }
}

/**
 * OfflineStore replaces a collapsed checkpoint payload instead of merging it.
 * Every save therefore serializes the entire meaningful answer for this
 * response type, including unchanged values restored into the editor draft.
 */
export function buildCompleteCheckpointPayload(
  item: Pick<
    InspectionRunItem,
    'responseType' | 'numericMin' | 'numericMax'
  >,
  draft: CheckpointEditorDraft,
): CompleteCheckpointPayloadResult {
  if (!draft.status) return { ok: false, message: 'Выберите результат проверки' }

  const payload: UpdateInspectionRunItemInput = {
    status: draft.status,
    requiresRepair: draft.status === 'ISSUE' || draft.status === 'CRITICAL',
    comment: draft.comment.trim(),
  }

  if (item.responseType === 'YES_NO') {
    if (draft.booleanValue === '') return { ok: false, message: 'Выберите ответ «Да» или «Нет»' }
    payload.booleanValue = draft.booleanValue === 'true'
  }

  if (item.responseType === 'NUMBER') {
    if (!draft.numberValue.trim()) return { ok: false, message: 'Введите числовое значение' }
    const value = Number(draft.numberValue)
    if (!Number.isFinite(value)) return { ok: false, message: 'Введите корректное число' }
    if (item.numericMin !== null && item.numericMin !== undefined && value < item.numericMin) {
      return { ok: false, message: `Значение не может быть меньше ${item.numericMin}` }
    }
    if (item.numericMax !== null && item.numericMax !== undefined && value > item.numericMax) {
      return { ok: false, message: `Значение не может быть больше ${item.numericMax}` }
    }
    payload.numberValue = value
  }

  if (item.responseType === 'TEXT') {
    const value = draft.textValue.trim()
    if (!value) return { ok: false, message: 'Введите текстовый ответ' }
    payload.textValue = value
  }

  return { ok: true, payload }
}
