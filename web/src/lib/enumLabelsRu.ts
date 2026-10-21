/**
 * Русские подписи для значений перечислений.
 *
 * Зачем отдельный модуль: значения перечислений — идентификаторы. По ним
 * сравнивает код, их принимает и возвращает API, они лежат в базе. Переводить
 * сами значения нельзя: ровно это и сломало сборку в прошлом заходе
 * (AIEmployeeStatus, TS2322 ×7). Поэтому значение остаётся английским, а на
 * экран уходит подпись из этих карт.
 *
 * Карты объявлены как Record<Тип, string>, то есть TypeScript потребует
 * подпись для КАЖДОГО значения: добавить вариант в перечисление и забыть
 * подпись не получится — сборка не пройдёт.
 *
 * Термины согласованы с владельцем продукта (глоссарий русификации).
 */

import type {
  CompanyType,
  InspectionRunItemStatus,
  ServiceContractRole,
  ServiceContractStatus,
} from './api'

/** Тип компании. Показывается под подписью «Тип компании», поэтому без слова «компания». */
export const COMPANY_TYPE_LABELS_RU: Record<CompanyType, string> = {
  CLIENT: 'Клиент',
  PROVIDER: 'Сервисная компания',
}

/** Договорная роль обслуживания. */
export const SERVICE_CONTRACT_ROLE_LABELS_RU: Record<ServiceContractRole, string> = {
  PRIMARY: 'Основной подрядчик',
  SECONDARY: 'Субподрядчик',
}

/** Состояние договора обслуживания. */
export const SERVICE_CONTRACT_STATUS_LABELS_RU: Record<ServiceContractStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Действует',
  INACTIVE: 'Неактивен',
  ENDED: 'Завершён',
}

/**
 * Результат пункта обхода.
 *
 * PENDING и SKIPPED дают одну подпись «Не заполнено» сознательно: для человека
 * это одно состояние — ответа нет. Так уже сделано в мобильной версии
 * (mobileInspectionRunEditing.CHECKPOINT_STATE_LABELS), и второй словарь с
 * другим смыслом здесь не заводится.
 */
export const INSPECTION_ITEM_STATUS_LABELS_RU: Record<InspectionRunItemStatus, string> = {
  PENDING: 'Не заполнено',
  OK: 'Норма',
  ISSUE: 'Выявлена проблема',
  CRITICAL: 'Критическая проблема',
  SKIPPED: 'Не заполнено',
}

/**
 * Короткие подписи результата — только для счётчиков в сводке.
 *
 * В мобильной сводке четыре ячейки стоят в один ряд на экране 360 px, и
 * «Критическая проблема» там не поместится. Это заголовки счётчиков, а не
 * названия статусов, поэтому формы отличаются осознанно; полные подписи
 * живут в INSPECTION_ITEM_STATUS_LABELS_RU.
 */
export const INSPECTION_ITEM_COUNTER_LABELS_RU: Record<InspectionRunItemStatus, string> = {
  PENDING: 'Ожидает',
  OK: 'Норма',
  ISSUE: 'Проблемы',
  CRITICAL: 'Критичные',
  SKIPPED: 'Пропущено',
}

/**
 * Короткие подписи результата — только для кнопок выбора в мобильном редакторе.
 *
 * Кнопки стоят сеткой repeat(3, minmax(0, 1fr)) с зазором 6px
 * (.mobilePatrolStatusChoices): на экране 360px каждой достаётся около 93px.
 * «Критическая проблема» там переносится на три строки и ломает редактор,
 * поэтому кнопка несёт короткую форму того же термина.
 *
 * Это не второй словарь: смысл и набор значений те же, отличается только
 * длина записи под ширину элемента. Полные подписи —
 * INSPECTION_ITEM_STATUS_LABELS_RU, и именно они показываются как статус.
 */
export const INSPECTION_ITEM_CHOICE_LABELS_RU: Record<InspectionRunItemStatus, string> = {
  PENDING: 'Не заполнено',
  OK: 'Норма',
  ISSUE: 'Проблема',
  CRITICAL: 'Критично',
  SKIPPED: 'Пропустить',
}
