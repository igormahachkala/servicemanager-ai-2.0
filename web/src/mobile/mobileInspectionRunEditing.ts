import type {
  InspectionRunItem,
  InspectionRunItemStatus,
  InspectionRunStatus,
  UpdateInspectionRunItemInput,
} from '../lib/api'
import { mobileTicketNumberTitle } from './mobileTicketDisplay'

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

// ── связанная заявка ────────────────────────────────────────────────────────

/**
 * SMA-MOBILE-ROUND-EDIT-LINKED-TICKET-WARNING-120W.
 *
 * Правка чек-поинта и жизнь заявки не связаны: сервер при обновлении отметки
 * не трогает ticketId и не меняет статус заявки. Это верно и до 120N, но
 * пока отметку нельзя было переоткрыть, техник до этого состояния почти не
 * доходил. Теперь «Изменить» доступно всегда, и «Норма» на пункте с живой
 * заявкой — один тап. Поведение от этого не стало неверным, но перестало
 * быть очевидным, и объяснить его нужно там, где решение принимается.
 *
 * Поэтому здесь только текст и условие показа. Ни отмены, ни закрытия, ни
 * отвязки заявки: заявка остаётся самостоятельной сущностью.
 */

export type CheckpointLinkedTicketNotice =
  /** Заявки нет — экран не шумит. */
  | { kind: 'none' }
  /** Заявка есть, результат не «Норма»: просто напоминание о независимости. */
  | { kind: 'info'; label: string; text: string }
  /** Заявка есть, выбрана «Норма»: противоречие на виду, предупреждаем до сохранения. */
  | { kind: 'warning'; label: string; text: string }

/**
 * Человекочитаемое имя заявки. Канонический источник — mobileTicketNumberTitle:
 * он даёт «Заявка #N», а без номера — «Заявка». Идентификатор в него не
 * попадает вообще, поэтому UUID отсюда выйти не может даже при отсутствии
 * номера (секунды между созданием заявки и обновлением обхода).
 */
export function checkpointLinkedTicketLabel(ticketNumber?: number | null): string {
  return mobileTicketNumberTitle(ticketNumber)
}

export function checkpointLinkedTicketNotice(input: {
  hasLinkedTicket: boolean
  ticketNumber?: number | null
  draftStatus: EditableCheckpointStatus | null
}): CheckpointLinkedTicketNotice {
  if (!input.hasLinkedTicket) return { kind: 'none' }

  const label = checkpointLinkedTicketLabel(input.ticketNumber)

  if (input.draftStatus === 'OK') {
    return {
      kind: 'warning',
      label,
      text: `По этому пункту уже создана ${lowerFirstWord(label)}. Изменение результата обхода не изменит и не отменит заявку.`,
    }
  }

  return {
    kind: 'info',
    label,
    // Утверждения о закрытии или отмене здесь быть не должно: заявка живёт
    // своей жизнью, и правка обхода ничего с ней не делает.
    text: `${label} создана по этому пункту и существует отдельно. Правка обхода её не изменит.`,
  }
}

function lowerFirstWord(value: string): string {
  return value ? `${value[0].toLocaleLowerCase('ru-RU')}${value.slice(1)}` : value
}
