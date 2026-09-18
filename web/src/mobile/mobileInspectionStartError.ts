import { ApiRequestError } from '../lib/api'
import {
  ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE,
  isActiveShiftRequiredError,
} from './mobileShiftGate'

export function mobileInspectionStartErrorMessage(error: unknown): string {
  if (isActiveShiftRequiredError(error)) {
    return ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return 'Начать обход в выбранном контуре нельзя. Проверьте доступ к локации.'
  }
  if (error instanceof ApiRequestError && error.status === 404) {
    return 'Шаблон или локация больше недоступны. Обновите выбор и повторите.'
  }
  return 'Не удалось начать обход. Проверьте соединение и повторите.'
}
