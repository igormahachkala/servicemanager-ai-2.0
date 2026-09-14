/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Словарь offline-слоя: состояния, реестр операций, правила конфликтов.
 *
 * Семантика перенесена из 113A (`offlineOperations.ts`, ветка
 * feat/mobile-offline-mode-v1-113a) и сохранена намеренно: русские подписи
 * состояний, пространство имён по компании и пользователю, «последнее
 * значение побеждает» для чек-поинтов. 113A целиком стоял на localStorage
 * и здесь заменяется хранилищем на IndexedDB, но принятые в нём правила
 * не переизобретаются.
 */

/** Русские подписи состояний. Другого источника этих строк быть не должно. */
export const OFFLINE_SYNC_LABEL = {
  savedLocally: 'Сохранено на устройстве',
  pending: 'Ожидает отправки',
  syncing: 'Синхронизация',
  synced: 'Синхронизировано',
  attention: 'Требует внимания',
  failed: 'Ошибка отправки',
} as const

export type OfflineSyncState = keyof typeof OFFLINE_SYNC_LABEL

/**
 * Состояние строки очереди.
 *
 * `attention` отделено от `failed` намеренно. `failed` — отправка не удалась,
 * но повторить осмысленно. `attention` — повторять нельзя: доступ отозван,
 * обход закрыли, цель исчезла. Во втором случае молча удалять работу техника
 * нельзя, и автоповтор только испортит дело.
 */
export type OfflineQueueStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'attention'

export type OfflineOperationKind =
  | 'ticket.comment'
  | 'ticket.attachment'
  | 'ticket.status'
  | 'checkpoint.update'
  | 'checkpoint.attachment'
  | 'ticket.fromRound'

export type OfflineOperationSpec = {
  kind: OfflineOperationKind
  /** Русское название для списка «Ожидает отправки». */
  title: string
  /**
   * Повторная отправка безопасна только с ключом идемпотентности: операция
   * добавляет сущность, и без ключа повтор создал бы дубль.
   */
  requiresIdempotencyKey: boolean
  /** Можно ли повторять автоматически при восстановлении связи. */
  autoRetry: boolean
  /**
   * Схлопывается ли повторное действие по той же цели. Чек-поинт схлопывается:
   * техник трижды переключил «Норма → Проблема → Норма», серверу нужно
   * последнее значение, а не три записи.
   */
  collapseByTarget: boolean
}

export const OFFLINE_OPERATIONS: Record<OfflineOperationKind, OfflineOperationSpec> = {
  'ticket.comment': {
    kind: 'ticket.comment',
    title: 'Комментарий к заявке',
    requiresIdempotencyKey: true,
    autoRetry: true,
    collapseByTarget: false,
  },
  'ticket.attachment': {
    kind: 'ticket.attachment',
    title: 'Фото к заявке',
    requiresIdempotencyKey: true,
    autoRetry: true,
    collapseByTarget: false,
  },
  'ticket.status': {
    kind: 'ticket.status',
    title: 'Статус заявки',
    requiresIdempotencyKey: false,
    autoRetry: true,
    collapseByTarget: true,
  },
  'checkpoint.update': {
    kind: 'checkpoint.update',
    title: 'Отметка по чек-поинту',
    requiresIdempotencyKey: false,
    autoRetry: true,
    collapseByTarget: true,
  },
  'checkpoint.attachment': {
    kind: 'checkpoint.attachment',
    title: 'Фото чек-поинта',
    requiresIdempotencyKey: true,
    autoRetry: true,
    collapseByTarget: false,
  },
  'ticket.fromRound': {
    kind: 'ticket.fromRound',
    title: 'Заявка из обхода',
    requiresIdempotencyKey: true,
    autoRetry: true,
    // 113D: схлопывание по цели. Чек-поинт порождает одну заявку, а без сети
    // техник легко нажмёт «создать» дважды — экран ведь не может показать
    // ему созданную заявку. Схлопывание оставляет одну строку с прежним
    // ключом идемпотентности, так что второе нажатие уточняет описание,
    // а не заводит вторую заявку.
    collapseByTarget: true,
  },
}

export function getOfflineOperationSpec(kind: string): OfflineOperationSpec | null {
  return (OFFLINE_OPERATIONS as Record<string, OfflineOperationSpec>)[kind] ?? null
}

export type OfflineQueueItem = {
  id: string
  kind: OfflineOperationKind
  /** Ключ идемпотентности 113B. Создаётся один раз и больше не меняется. */
  idempotencyKey: string
  /**
   * Цель операции. `ticketId` может быть локальным до синхронизации
   * «заявки из обхода» — тогда он начинается с `local:`.
   */
  target: {
    ticketId?: string
    roundId?: string
    checkpointId?: string
    locationId?: string
  }
  payload: Record<string, unknown>
  /** Идентификатор сохранённого Blob, если операция несёт файл. */
  blobId?: string
  /** Локальный id операции, без которой эту отправлять нельзя. */
  dependsOnId?: string
  /**
   * Операция создаёт заявку: её результат подставляется зависимым операциям
   * вместо локального `local:` идентификатора.
   */
  producesTicketId?: boolean
  status: OfflineQueueStatus
  attempts: number
  createdAt: string
  updatedAt: string
  lastError?: string
  /** Русское пояснение для состояния «Требует внимания». */
  attentionReason?: string
}

/** Коды 113B и HTTP-исходы, которые нельзя повторять вслепую. */
export type SyncOutcome =
  | { kind: 'ok'; serverId?: string }
  | { kind: 'retry'; message: string }
  | { kind: 'attention'; reason: string }

/**
 * Разбор ответа сервера. Правило одно: если применить изменение уже нельзя,
 * локальная работа не удаляется, а уходит в «Требует внимания» с объяснением
 * по-русски. Тихо затирать состояние сервера тоже нельзя.
 */
export function classifySyncFailure(input: {
  status?: number
  code?: string
  message?: string
}): SyncOutcome {
  const code = (input.code || '').toUpperCase()

  // 113B: ключ уже использован с другим телом запроса. Повтор не поможет —
  // это расхождение, которое должен увидеть человек.
  if (code === 'IDEMPOTENCY_KEY_CONFLICT') {
    return { kind: 'attention', reason: 'Операция уже выполнялась с другими данными. Проверьте результат на сервере.' }
  }
  // 113B: результат прошлой попытки больше не хранится. Повторять опасно:
  // можно создать дубль, о котором никто не узнает.
  if (code === 'IDEMPOTENCY_RESULT_GONE') {
    return { kind: 'attention', reason: 'Сервер больше не помнит результат этой операции. Проверьте, применилась ли она.' }
  }
  // 113B: та же операция выполняется прямо сейчас. Это не ошибка — подождать.
  if (code === 'IDEMPOTENCY_IN_PROGRESS') {
    return { kind: 'retry', message: 'Операция уже обрабатывается сервером' }
  }

  if (input.status === 401) {
    return { kind: 'retry', message: 'Требуется вход' }
  }
  if (input.status === 403) {
    return { kind: 'attention', reason: 'Доступ к объекту отозван. Работа сохранена на устройстве.' }
  }
  if (input.status === 404 || input.status === 410) {
    return { kind: 'attention', reason: 'Объект больше не доступен. Работа сохранена на устройстве.' }
  }
  if (input.status === 409) {
    return { kind: 'attention', reason: 'Состояние на сервере изменилось. Работа сохранена на устройстве.' }
  }
  if (typeof input.status === 'number' && input.status >= 400 && input.status < 500) {
    return { kind: 'attention', reason: input.message || 'Сервер отклонил операцию. Работа сохранена на устройстве.' }
  }

  // Сеть и 5xx — обычный повтор.
  return { kind: 'retry', message: input.message || 'Нет связи с сервером' }
}

/** Состояние строки очереди в терминах интерфейса. */
export function syncStateOf(item: Pick<OfflineQueueItem, 'status'>): OfflineSyncState {
  switch (item.status) {
    case 'pending':
      return 'pending'
    case 'syncing':
      return 'syncing'
    case 'synced':
      return 'synced'
    case 'attention':
      return 'attention'
    case 'failed':
      return 'failed'
    default:
      return 'savedLocally'
  }
}

/**
 * Пространство имён приватных данных: компания и пользователь.
 * Перенесено из 113A. Под каждое — отдельная база, поэтому выход из учётной
 * записи сводится к удалению базы целиком, а не к выборочной чистке.
 */
export function offlineNamespace(user?: { id?: string | null; companyId?: string | null } | null): string | null {
  const companyId = (user?.companyId || '').trim()
  const userId = (user?.id || '').trim()
  if (!companyId || !userId) return null
  return `${companyId}:${userId}`
}

export function offlineDatabaseName(namespace: string): string {
  return `sma-offline:${namespace}`
}
