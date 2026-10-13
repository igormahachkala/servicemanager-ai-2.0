export type V2DevStatus = 'planned' | 'in_progress' | 'partial' | 'available'

export type V2PageMeta = {
  path: string
  title: string
  description: string
  status: V2DevStatus
  taskRef?: string
  legacyPath?: string
  legacyLabel?: string
}

export const V2_DEV_STATUS_LABEL: Record<V2DevStatus, string> = {
  planned: 'Запланировано',
  in_progress: 'В разработке',
  partial: 'Частично доступно',
  available: 'Доступно',
}

export const V2_STUB_PAGES: V2PageMeta[] = [
  {
    path: '/dashboard',
    title: 'Операционный центр',
    description:
      'Операционный центр Консоли управления V2: показатели, центр действий, радар SLA и очереди назначения. Первый экран после входа в новый контур.',
    status: 'in_progress',
    taskRef: 'SMA-MGMT-T02',
  },
  {
    path: '/acts',
    title: 'Акты',
    description:
      'Акты выполненных работ: список, фильтры по статусу, экспорт и связь с приёмкой заявок.',
    status: 'in_progress',
    taskRef: 'SMA-MGMT-T02',
  },
  {
    path: '/assistant',
    title: 'Ассистент MAX',
    description:
      'Операционный помощник в десктоп-контуре: сводка рисков, предложения действий и контекст заявки.',
    status: 'in_progress',
    taskRef: 'SMA-MGMT-T02',
  },
  {
    path: '/contractors',
    title: 'Подрядчики',
    description:
      'Управление связями клиент–провайдер, договоры обслуживания и контур подрядчиков арендатора.',
    status: 'partial',
    taskRef: 'SMA-MGMT-T02',
    legacyPath: '/service-contracts',
    legacyLabel: 'Договоры обслуживания (платформа)',
  },
]

const stubByPath = new Map(V2_STUB_PAGES.map((page) => [page.path, page]))

export function getV2StubPageMeta(pathname: string): V2PageMeta | null {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return stubByPath.get(normalized) || null
}
