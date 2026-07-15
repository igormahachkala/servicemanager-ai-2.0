import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import * as api from '../../lib/api'

type WizardStep = 1 | 2 | 3 | 4

type CapabilityDomain = 'tickets' | 'people' | 'assets' | 'analytics' | 'settings'

type CapabilityMeta = {
  code: string
  domain: CapabilityDomain
  label: string
  description: string
  risk?: 'admin' | 'wide' | 'medium'
}

type LocationOption = api.AccessLocationOption & {
  clientCompanyId: string
  clientName: string
  city: string
}

type SaveInput = {
  userId: string
  permissionsToGrant: string[]
  permissionsToRemove: string[]
  locationGroupsToRemove: Array<{ clientCompanyId: string; locationIds: string[] }>
  locationGroupsToReplace: api.AccessLocationBindingGroup[]
}

const steps: Array<{ id: WizardStep; title: string }> = [
  { id: 1, title: 'Сотрудник и роль' },
  { id: 2, title: 'Контур работы' },
  { id: 3, title: 'Возможности' },
  { id: 4, title: 'Проверка' },
]

const capabilities: CapabilityMeta[] = [
  {
    code: 'TICKETS_VIEW',
    domain: 'tickets',
    label: 'Просмотр заявок',
    description: 'Видит заявки в доступном рабочем контуре.',
  },
  {
    code: 'TICKETS_CREATE',
    domain: 'tickets',
    label: 'Создание заявок',
    description: 'Может создавать новые заявки и дочерние работы.',
  },
  {
    code: 'TICKETS_VIEW_AVAILABLE',
    domain: 'tickets',
    label: 'Просмотр доступных заявок',
    description: 'Видит новые заявки, которые можно взять в работу.',
  },
  {
    code: 'TICKETS_EDIT',
    domain: 'tickets',
    label: 'Редактирование заявок',
    description: 'Может менять описание, приоритет и основные поля заявки.',
  },
  {
    code: 'TICKETS_ASSIGN',
    domain: 'tickets',
    label: 'Назначение исполнителей',
    description: 'Может назначать сотрудников на заявки.',
  },
  {
    code: 'TICKETS_CLAIM',
    domain: 'tickets',
    label: 'Взять заявку в работу',
    description: 'Может взять доступную заявку или запросить назначение.',
  },
  {
    code: 'TICKETS_STATUS_CHANGE',
    domain: 'tickets',
    label: 'Изменение статуса заявки',
    description: 'Может переводить заявку между рабочими статусами.',
  },
  {
    code: 'TICKETS_VIEW_ALL_COMPANY',
    domain: 'tickets',
    label: 'Просмотр всех заявок компании',
    description: 'Расширяет видимость за пределы обычного контура сотрудника.',
    risk: 'wide',
  },
  {
    code: 'USERS_MANAGE',
    domain: 'people',
    label: 'Управление сотрудниками',
    description: 'Создание, изменение и настройка доступа сотрудников.',
    risk: 'admin',
  },
  {
    code: 'LOCATIONS_VIEW',
    domain: 'assets',
    label: 'Просмотр объектов',
    description: 'Видит объекты, оборудование, категории и карту.',
  },
  {
    code: 'LOCATIONS_MANAGE',
    domain: 'assets',
    label: 'Управление объектами',
    description: 'Может изменять объекты и оборудование.',
    risk: 'admin',
  },
  {
    code: 'ANALYTICS_VIEW',
    domain: 'analytics',
    label: 'Просмотр аналитики',
    description: 'Доступ к отчетам и операционной аналитике.',
  },
  {
    code: 'COMPANY_SETTINGS_EDIT',
    domain: 'settings',
    label: 'Управление настройками компании',
    description: 'Может изменять настройки компании и справочники.',
    risk: 'admin',
  },
]

const domainLabels: Record<CapabilityDomain, string> = {
  tickets: 'Заявки',
  people: 'Сотрудники',
  assets: 'Объекты и оборудование',
  analytics: 'Аналитика',
  settings: 'Настройки',
}

const roleLabels: Record<string, string> = {
  PLATFORM_ADMIN: 'Администратор платформы',
  ADMIN: 'Администратор',
  ADMIN_PROVIDER: 'Администратор провайдера',
  DISPATCHER: 'Диспетчер',
  MASTER: 'Мастер',
  TECHNICIAN: 'Техник',
  CLIENT: 'Клиент',
  TERRITORIAL_MANAGER: 'Территориальный менеджер',
  NETWORK_DIRECTOR: 'Руководитель сети',
  STAFF: 'Сотрудник',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
}

const cellStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  textAlign: 'left',
  verticalAlign: 'top',
}

const drawerOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.28)',
  zIndex: 60,
  display: 'flex',
  justifyContent: 'flex-end',
}

const drawerStyle: CSSProperties = {
  width: 'min(980px, 96vw)',
  height: '100%',
  background: '#fff',
  boxShadow: '-16px 0 36px rgba(15,23,42,0.18)',
  display: 'flex',
  flexDirection: 'column',
}

const fallbackCapabilityByCode = new Map(capabilities.map((item) => [item.code, item]))

function text(value?: string | null): string {
  return (value || '').trim()
}

function userName(user: api.AccessConstructorUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email
}

function roleLabel(role?: string | null): string {
  return role ? roleLabels[role] || 'Сотрудник' : 'Сотрудник'
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function sameIds(a: string[], b: string[]): boolean {
  const left = [...new Set(a)].sort()
  const right = [...new Set(b)].sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function capabilityMeta(code: string, catalog?: api.PermissionCatalogItem[]): CapabilityMeta {
  const catalogItem = catalog?.find((item) => item.code === code)
  if (catalogItem) {
    return {
      code,
      domain: mapProductDomain(catalogItem.productDomain),
      label: text(catalogItem.businessLabel) || text(catalogItem.name) || 'Дополнительная возможность',
      description: text(catalogItem.description) || 'Дополнительное действие в рабочем контуре сотрудника.',
      risk: catalogItem.riskLevel === 'high' ? 'admin' : catalogItem.riskLevel === 'medium' ? 'medium' : undefined,
    }
  }
  return (
    fallbackCapabilityByCode.get(code) || {
      code,
      domain: 'settings',
      label: 'Дополнительная возможность',
      description: 'Возможность из системного каталога доступа.',
    }
  )
}

function mapProductDomain(domain?: string): CapabilityDomain {
  const value = (domain || '').toLowerCase()
  if (value.includes('заяв')) return 'tickets'
  if (value.includes('сотруд')) return 'people'
  if (value.includes('объ') || value.includes('оборуд')) return 'assets'
  if (value.includes('аналит')) return 'analytics'
  if (value.includes('настро')) return 'settings'
  return 'settings'
}

function capabilityLabels(codes: string[], catalog?: api.PermissionCatalogItem[], limit = 3): string {
  if (codes.length === 0) return 'Нет доступных действий'
  const labels = codes.map((code) => capabilityMeta(code, catalog).label)
  const head = labels.slice(0, limit).join(', ')
  return labels.length > limit ? `${head} + ещё ${labels.length - limit}` : head
}

function contourRoleLabel(role: api.AccessClientContour['role']): string {
  if (role === 'OWN_CLIENT') return 'Собственные объекты'
  if (role === 'PRIMARY') return 'Основной подрядчик'
  if (role === 'SECONDARY') return 'Субподрядчик'
  return 'Рабочий контур'
}

function contourTitle(contour: api.AccessClientContour): string {
  if (contour.role === 'OWN_CLIENT') return 'Мои объекты'
  return `Объекты клиента «${contour.name}»`
}

function locationTitle(location: Pick<LocationOption, 'displayName' | 'name' | 'platformCode'>): string {
  return text(location.displayName) || text(location.name) || text(location.platformCode) || 'Объект без названия'
}

function locationSubtitle(location: Pick<LocationOption, 'city' | 'address'>): string {
  const parts = [text(location.city), text(location.address)].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Адрес не указан'
}

function statusLabel(user: api.AccessConstructorUser): string {
  if (user.deletedAt) return 'Удален'
  return user.isActive === false ? 'Отключен' : 'Активен'
}

function companyTypeLabel(type?: string | null): string {
  if (type === 'CLIENT') return 'Клиентская компания'
  if (type === 'PROVIDER') return 'Сервисная компания'
  return 'Компания'
}

function hasRiskyCapability(codes: string[], catalog?: api.PermissionCatalogItem[]): boolean {
  return codes.some((code) => capabilityMeta(code, catalog).risk)
}

function riskLabel(entry: api.AccessSummaryEntry): { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } {
  if (entry.issueFlags.includes('no_locations') || entry.issueFlags.includes('restricted_empty')) {
    return { label: 'Нет выбранных объектов', tone: 'danger' }
  }
  if (entry.issueFlags.includes('stale_bindings')) return { label: 'Есть устаревшие объекты', tone: 'warn' }
  if (entry.issueFlags.includes('elevated_overrides')) return { label: 'Расширенный доступ', tone: 'warn' }
  if (entry.additiveOverrideCount > 0) return { label: 'Индивидуально', tone: 'warn' }
  return { label: 'OK', tone: 'ok' }
}

function warningLabel(codeOrText: string): string {
  if (codeOrText === 'no_locations') return 'Не выбраны объекты: сотрудник не увидит рабочий контур.'
  if (codeOrText === 'stale_bindings') return 'Есть устаревшие привязки к объектам. Они не считаются действующим доступом.'
  if (codeOrText === 'elevated_overrides') return 'Добавлены расширенные возможности. Проверьте необходимость перед сохранением.'
  if (codeOrText === 'invalid_location_selection') return 'Некоторые объекты недоступны или больше не входят в разрешенный контур.'
  return codeOrText
}

function visibilityLabel(mode?: string): string {
  if (mode === 'restricted_empty_scope') return 'Нет выбранных объектов'
  if (mode === 'assigned_and_available_bound_locations') return 'Назначенные и доступные заявки на выбранных объектах'
  if (mode === 'assigned_and_available') return 'Назначенные и доступные заявки'
  if (mode === 'provider_primary_and_secondary_operational') return 'Клиенты основного и субподрядного контура'
  if (mode === 'provider_secondary_operational') return 'Субподрядный рабочий контур'
  if (mode === 'provider_primary') return 'Основной подрядный контур'
  if (mode === 'tenant_bound_locations') return 'Выбранные объекты компании'
  if (mode === 'platform_observer') return 'Контур платформы'
  if (mode === 'tenant') return 'Компания'
  return 'Рабочий контур'
}

function riskStyle(tone: 'ok' | 'warn' | 'danger' | 'muted'): CSSProperties {
  if (tone === 'danger') return { background: '#fee2e2', color: '#991b1b' }
  if (tone === 'warn') return { background: '#fef3c7', color: '#92400e' }
  if (tone === 'ok') return { background: '#dcfce7', color: '#166534' }
  return { background: '#f1f5f9', color: '#475569' }
}

function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'muted' }) {
  return (
    <span
      className="small"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '2px 8px',
        borderRadius: 999,
        fontWeight: 800,
        ...riskStyle(tone),
      }}
    >
      {children}
    </span>
  )
}

function CountCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel" style={{ margin: 0, padding: 12 }}>
      <div className="muted small">{label}</div>
      <div style={{ fontSize: typeof value === 'number' ? 24 : 15, fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function Stepper({ step, onStep }: { step: WizardStep; onStep: (step: WizardStep) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      {steps.map((item) => (
        <button
          key={item.id}
          className={step === item.id ? undefined : 'ghost'}
          onClick={() => onStep(item.id)}
          style={{ justifyContent: 'flex-start', textAlign: 'left' }}
        >
          {item.id}. {item.title}
        </button>
      ))}
    </div>
  )
}

export function AccessConstructorPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get('companyId') || undefined
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [step, setStep] = useState<WizardStep>(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [issueFilter, setIssueFilter] = useState('all')
  const [locationSearch, setLocationSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [draftOverrideCodesByUser, setDraftOverrideCodesByUser] = useState<Record<string, string[]>>({})
  const [draftLocationIdsByUser, setDraftLocationIdsByUser] = useState<Record<string, string[]>>({})
  const [draftContourIdsByUser, setDraftContourIdsByUser] = useState<Record<string, string[]>>({})
  const [restrictedEmptyByUser, setRestrictedEmptyByUser] = useState<Record<string, boolean>>({})

  const summaryQ = useQuery({
    queryKey: ['access-summary', companyId, search, roleFilter, statusFilter, issueFilter],
    queryFn: () => api.fetchAccessSummary({
      companyId,
      q: search,
      role: roleFilter === 'all' ? undefined : roleFilter,
      status: statusFilter === 'all' ? undefined : statusFilter as 'active' | 'inactive',
      issue: issueFilter === 'all' || issueFilter === 'individual' ? undefined : issueFilter,
      take: 250,
    }),
  })
  const catalogQ = useQuery({ queryKey: ['permissions-catalog'], queryFn: api.fetchPermissionCatalog })
  const contoursQ = useQuery({ queryKey: ['access-client-contours', companyId], queryFn: () => api.fetchAccessClientContours(companyId) })

  const rows = useMemo(() => summaryQ.data?.users ?? [], [summaryQ.data?.users])
  const company = summaryQ.data?.company ?? null
  const selectedEntry = rows.find((entry) => entry.user.id === selectedUserId) ?? null
  const selectedUser = selectedEntry?.user ?? null

  const effectiveQ = useQuery({
    queryKey: ['access-effective-permissions', selectedUserId, companyId],
    enabled: !!selectedUserId,
    queryFn: () => api.fetchAccessEffectivePermissions(selectedUserId ?? '', companyId),
  })
  const overridesQ = useQuery({
    queryKey: ['access-user-overrides', selectedUserId, companyId],
    enabled: !!selectedUserId,
    queryFn: () => api.fetchAccessUserOverrides(selectedUserId ?? '', companyId),
  })
  const bindingsQ = useQuery({
    queryKey: ['access-location-bindings', selectedUserId, companyId],
    enabled: !!selectedUserId,
    queryFn: () => api.fetchAccessLocationBindings(selectedUserId ?? '', companyId),
  })
  const previewQ = useQuery({
    queryKey: ['access-preview', selectedUserId, companyId],
    enabled: !!selectedUserId,
    queryFn: () => api.fetchAccessPreview(selectedUserId ?? '', companyId),
  })

  const currentOverrideCodes = overridesQ.data?.codes ?? selectedEntry?.permissions.overrideCodes ?? []
  const draftOverrideCodes = selectedUserId ? draftOverrideCodesByUser[selectedUserId] ?? currentOverrideCodes : []
  const currentLocationIds = useMemo(
    () => bindingsQ.data?.bindings.map((binding) => binding.locationId) ?? [],
    [bindingsQ.data?.bindings],
  )
  const currentContourIds = useMemo(
    () => (bindingsQ.data ? unique(bindingsQ.data.bindings.map((binding) => binding.location.clientCompanyId)) : []),
    [bindingsQ.data],
  )
  const selectedContourIds = useMemo(
    () => (selectedUserId ? draftContourIdsByUser[selectedUserId] ?? currentContourIds : []),
    [currentContourIds, draftContourIdsByUser, selectedUserId],
  )
  const selectedLocationIds = useMemo(
    () => (selectedUserId ? draftLocationIdsByUser[selectedUserId] ?? currentLocationIds : []),
    [currentLocationIds, draftLocationIdsByUser, selectedUserId],
  )
  const restrictedEmptyRequested = selectedUserId ? restrictedEmptyByUser[selectedUserId] === true : false
  const locationSelectionChanged = !sameIds(selectedLocationIds, currentLocationIds)
  const locationChangeRequested = locationSelectionChanged || restrictedEmptyRequested

  const availableLocationsQ = useQuery({
    queryKey: ['access-location-options', companyId, selectedContourIds],
    enabled: selectedContourIds.length > 0,
    queryFn: async () => {
      const response = await api.fetchAccessLocationOptions(selectedContourIds, companyId)
      return response.clients.flatMap((clientGroup) =>
        clientGroup.cities.flatMap((cityGroup) =>
          cityGroup.locations.map((location) => ({
            ...location,
            clientCompanyId: clientGroup.client.id,
            clientName: clientGroup.client.name,
            city: cityGroup.city,
          })),
        ),
      )
    },
  })

  const draftPreviewQ = useQuery({
    queryKey: ['access-draft-preview', companyId, selectedUserId, draftOverrideCodes, selectedLocationIds, selectedContourIds, locationChangeRequested],
    enabled: !!selectedUserId && !overridesQ.isLoading && !bindingsQ.isLoading,
    queryFn: () => api.fetchAccessDraftPreview(
      selectedUserId ?? '',
      {
        additivePermissionCodes: draftOverrideCodes,
        locationIds: locationChangeRequested ? selectedLocationIds : undefined,
        selectedClientContourIds: locationChangeRequested ? selectedContourIds : undefined,
      },
      companyId,
    ),
  })

  const visibleRows = useMemo(() => {
    return rows.filter((entry) => {
      if (issueFilter === 'individual' && entry.additiveOverrideCount === 0) return false
      if (issueFilter === 'elevated_overrides' && !entry.issueFlags.includes('elevated_overrides')) return false
      return true
    })
  }, [issueFilter, rows])

  const roles = useMemo(() => unique(rows.map((entry) => entry.user.role)).sort(), [rows])

  const locationById = useMemo(() => {
    const map = new Map<string, LocationOption>()
    for (const binding of bindingsQ.data?.bindings ?? []) {
      map.set(binding.locationId, {
        id: binding.location.id,
        clientCompanyId: binding.location.clientCompanyId,
        clientName: contoursQ.data?.contours.find((contour) => contour.id === binding.location.clientCompanyId)?.name || 'Клиент',
        displayName: binding.location.name || binding.location.platformCode,
        name: binding.location.name,
        platformCode: binding.location.platformCode,
        city: binding.location.city || 'Город не указан',
        region: binding.location.region,
        address: binding.location.address,
        active: binding.location.isActive,
        available: binding.location.deletedAt === null,
      })
    }
    for (const location of availableLocationsQ.data ?? []) {
      map.set(location.id, location)
    }
    return map
  }, [availableLocationsQ.data, bindingsQ.data?.bindings, contoursQ.data?.contours])

  const selectedLocationOptions = selectedLocationIds
    .map((id) => locationById.get(id))
    .filter((location): location is LocationOption => !!location)

  const selectedClientCount = unique(selectedLocationOptions.map((location) => location.clientCompanyId)).length
  const selectedLocationCount = selectedLocationIds.length

  const effectiveRoleCodes = effectiveQ.data?.permissions.codes.role ?? selectedEntry?.permissions.roleCodes ?? []
  const effectiveCodesAfterSave = unique([...effectiveRoleCodes, ...draftOverrideCodes])
  const availableCapabilityCodes = unique([
    ...capabilities.map((item) => item.code),
    ...(catalogQ.data ?? []).map((item) => item.code),
    ...effectiveRoleCodes,
    ...currentOverrideCodes,
  ])

  const saveBlocker = useMemo(() => {
    if (!selectedUserId || !locationChangeRequested) return ''
    const desiredLocations = selectedLocationIds.map((id) => locationById.get(id))
    if (desiredLocations.some((location) => !location)) {
      return 'Не удалось безопасно проверить выбранные объекты. Обновите список объектов и попробуйте снова.'
    }
    if (draftPreviewQ.data?.saveRejected) return draftPreviewQ.data.saveBlockers.map((blocker) => warningLabel(blocker.code)).join(' ')
    return ''
  }, [draftPreviewQ.data, locationById, locationChangeRequested, selectedLocationIds, selectedUserId])

  const saveM = useMutation({
    mutationFn: async (input: SaveInput) => {
      if (input.permissionsToGrant.length > 0) {
        await api.grantAccessUserPermissions(input.userId, input.permissionsToGrant, companyId)
      }
      if (input.permissionsToRemove.length > 0) {
        await api.removeAccessUserPermissions(input.userId, input.permissionsToRemove, companyId)
      }
      for (const group of input.locationGroupsToRemove) {
        await api.removeAccessLocationBindings(input.userId, {
          clientCompanyId: group.clientCompanyId,
          locationIds: group.locationIds,
        }, companyId)
      }
      if (input.locationGroupsToReplace.length > 0) {
        await api.replaceAllAccessLocationBindings(input.userId, input.locationGroupsToReplace, companyId)
      }
    },
    onSuccess: async (_data, variables) => {
      setShowConfirm(false)
      setDraftOverrideCodesByUser((prev) => {
        const next = { ...prev }
        delete next[variables.userId]
        return next
      })
      setDraftLocationIdsByUser((prev) => {
        const next = { ...prev }
        delete next[variables.userId]
        return next
      })
      setDraftContourIdsByUser((prev) => {
        const next = { ...prev }
        delete next[variables.userId]
        return next
      })
      setRestrictedEmptyByUser((prev) => {
        const next = { ...prev }
        delete next[variables.userId]
        return next
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['access-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['access-effective-permissions', variables.userId] }),
        queryClient.invalidateQueries({ queryKey: ['access-user-overrides', variables.userId] }),
        queryClient.invalidateQueries({ queryKey: ['access-location-bindings', variables.userId] }),
        queryClient.invalidateQueries({ queryKey: ['access-preview', variables.userId] }),
        queryClient.invalidateQueries({ queryKey: ['access-draft-preview'] }),
      ])
    },
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedUserId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function selectUser(userId: string) {
    setSelectedUserId(userId)
    setStep(1)
    setLocationSearch('')
    setShowConfirm(false)
  }

  function setDraftOverrides(codes: string[]) {
    if (!selectedUserId) return
    setDraftOverrideCodesByUser((prev) => ({ ...prev, [selectedUserId]: unique(codes) }))
  }

  function setDraftLocations(locationIds: string[]) {
    if (!selectedUserId) return
    setDraftLocationIdsByUser((prev) => ({ ...prev, [selectedUserId]: unique(locationIds) }))
    setRestrictedEmptyByUser((prev) => ({ ...prev, [selectedUserId]: false }))
  }

  function setDraftContours(contourIds: string[]) {
    if (!selectedUserId) return
    setDraftContourIdsByUser((prev) => ({ ...prev, [selectedUserId]: unique(contourIds) }))
  }

  function toggleContour(contourId: string) {
    const exists = selectedContourIds.includes(contourId)
    const nextContours = exists
      ? selectedContourIds.filter((id) => id !== contourId)
      : [...selectedContourIds, contourId]
    const nextLocations = exists
      ? selectedLocationIds.filter((id) => locationById.get(id)?.clientCompanyId !== contourId)
      : selectedLocationIds
    setDraftContours(nextContours)
    setDraftLocations(nextLocations)
  }

  function toggleLocation(locationId: string) {
    setDraftLocations(
      selectedLocationIds.includes(locationId)
        ? selectedLocationIds.filter((id) => id !== locationId)
        : [...selectedLocationIds, locationId],
    )
  }

  function clearLocationScope() {
    if (!selectedUserId) return
    setDraftContourIdsByUser((prev) => ({ ...prev, [selectedUserId]: [] }))
    setDraftLocationIdsByUser((prev) => ({ ...prev, [selectedUserId]: [] }))
    setRestrictedEmptyByUser((prev) => ({ ...prev, [selectedUserId]: true }))
  }

  function toggleOverride(code: string) {
    if (effectiveRoleCodes.includes(code)) return
    setDraftOverrides(
      draftOverrideCodes.includes(code)
        ? draftOverrideCodes.filter((item) => item !== code)
        : [...draftOverrideCodes, code],
    )
  }

  function buildSaveInput(): SaveInput | null {
    if (!selectedUserId || saveBlocker) return null
    const desiredOverrides = unique(draftOverrideCodes)
    const currentOverrides = unique(currentOverrideCodes)
    const permissionsToGrant = desiredOverrides.filter((code) => !currentOverrides.includes(code))
    const permissionsToRemove = currentOverrides.filter((code) => !desiredOverrides.includes(code))
    const locationGroupsToRemove: SaveInput['locationGroupsToRemove'] = []
    const locationGroupsToReplace: SaveInput['locationGroupsToReplace'] = []

    if (locationChangeRequested) {
      if (selectedLocationIds.length === 0) {
        locationGroupsToReplace.push({ mode: 'CLEAR_RESTRICTED_EMPTY' })
        return { userId: selectedUserId, permissionsToGrant, permissionsToRemove, locationGroupsToRemove, locationGroupsToReplace }
      }

      const removedByClient = new Map<string, string[]>()
      for (const locationId of currentLocationIds.filter((id) => !selectedLocationIds.includes(id))) {
        const location = locationById.get(locationId)
        if (!location) return null
        removedByClient.set(location.clientCompanyId, [...(removedByClient.get(location.clientCompanyId) ?? []), locationId])
      }
      for (const [clientCompanyId, locationIds] of removedByClient.entries()) {
        locationGroupsToRemove.push({ clientCompanyId, locationIds: unique(locationIds) })
      }

      const grouped = new Map<string, string[]>()
      for (const locationId of selectedLocationIds) {
        const location = locationById.get(locationId)
        if (!location) return null
        grouped.set(location.clientCompanyId, [...(grouped.get(location.clientCompanyId) ?? []), locationId])
      }
      for (const [clientCompanyId, locationIds] of grouped.entries()) {
        locationGroupsToReplace.push({ mode: 'REPLACE_SELECTED', clientCompanyId, locationIds: unique(locationIds) })
      }
    }

    return { userId: selectedUserId, permissionsToGrant, permissionsToRemove, locationGroupsToRemove, locationGroupsToReplace }
  }

  function openConfirm() {
    if (!buildSaveInput()) return
    setShowConfirm(true)
  }

  function confirmSave() {
    const input = buildSaveInput()
    if (!input) return
    saveM.mutate(input)
  }

  const roleCodesSet = new Set(effectiveRoleCodes)
  const draftOverridesSet = new Set(draftOverrideCodes)
  const currentPreview = draftPreviewQ.data?.preview ?? previewQ.data ?? null
  const proposedClientCount = draftPreviewQ.data?.proposed.companyCount ?? selectedClientCount
  const proposedLocationCount = draftPreviewQ.data?.proposed.locationCount ?? selectedLocationCount
  const proposedVisibility = visibilityLabel(draftPreviewQ.data?.proposed.ticketVisibilityMode ?? currentPreview?.ticketVisibilityMode)
  const warnings = (draftPreviewQ.data?.warnings ?? []).map(warningLabel)
  if (hasRiskyCapability(effectiveCodesAfterSave, catalogQ.data)) warnings.push('Включены административные или расширенные возможности. Проверьте, что они действительно нужны.')
  if ((bindingsQ.data?.staleCount ?? 0) > 0) warnings.push('Есть устаревшие привязки к объектам. Они не считаются действующим доступом.')
  if (saveBlocker) warnings.push(saveBlocker)

  return (
    <div>
      <div className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Конструктор доступа</h2>
          <div className="muted small">Настройка рабочих контуров сотрудников простым бизнес-языком.</div>
        </div>
      </div>

      <div className="panel uiCard" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) repeat(3, minmax(150px, 190px))', gap: 10 }}>
          <input
            placeholder="Поиск по имени, email, телефону или роли"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Все роли</option>
            {roles.map((role) => (
              <option key={role} value={role}>{roleLabel(role)}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Любой статус</option>
            <option value="active">Активные</option>
            <option value="inactive">Отключенные</option>
          </select>
          <select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)}>
            <option value="all">Все состояния доступа</option>
            <option value="no_locations">Нет выбранных объектов</option>
            <option value="individual">Есть индивидуальные настройки</option>
            <option value="elevated_overrides">Расширенный доступ</option>
          </select>
        </div>
      </div>

      {summaryQ.isError ? <div className="alert">Не удалось загрузить сотрудников: {errorMessage(summaryQ.error)}</div> : null}

      <div className="panel uiCard" style={{ overflow: 'hidden', padding: 0 }}>
        <div className="row" style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Сотрудники</div>
            <div className="muted small">{company ? `${company.name} · ${companyTypeLabel(company.type)}` : 'Загрузка компании...'}</div>
          </div>
          <div className="muted small">{visibleRows.length} из {summaryQ.data?.page.total ?? rows.length}</div>
        </div>

        {summaryQ.isLoading ? (
          <div style={{ padding: 16 }} className="muted small">Загружаем сотрудников...</div>
        ) : visibleRows.length === 0 ? (
          <div style={{ padding: 16 }} className="muted small">Сотрудники не найдены.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={cellStyle}>Сотрудник</th>
                  <th style={cellStyle}>Роль</th>
                  <th style={cellStyle}>Компания</th>
                  <th style={cellStyle}>Клиенты</th>
                  <th style={cellStyle}>Объекты</th>
                  <th style={cellStyle}>Доступ</th>
                  <th style={cellStyle}>Риск</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((entry) => {
                  const risk = riskLabel(entry)
                  return (
                    <tr
                      key={entry.user.id}
                      onClick={() => selectUser(entry.user.id)}
                      style={{
                        cursor: 'pointer',
                        background: entry.user.id === selectedUserId ? '#eff6ff' : '#fff',
                      }}
                    >
                      <td style={cellStyle}>
                        <div style={{ fontWeight: 800 }}>{userName(entry.user)}</div>
                        <div className="muted small">{entry.user.email}</div>
                      </td>
                      <td style={cellStyle}>{roleLabel(entry.user.role)}</td>
                      <td style={cellStyle}>{company?.name ?? '—'}</td>
                      <td style={cellStyle}>{entry.accessibleCompanyCount}</td>
                      <td style={cellStyle}>{entry.accessibleLocationCount}</td>
                      <td style={cellStyle}>
                        <div className="small">{capabilityLabels(entry.permissions.effectiveCodes, catalogQ.data)}</div>
                        {entry.additiveOverrideCount > 0 ? <div className="muted small">Есть индивидуальные настройки</div> : null}
                      </td>
                      <td style={cellStyle}><Pill tone={risk.tone}>{risk.label}</Pill></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser ? (
        <div style={drawerOverlayStyle} onClick={() => setSelectedUserId(null)}>
          <aside style={drawerStyle} onClick={(event) => event.stopPropagation()} aria-label="Конструктор доступа">
            <div
              className="row"
              style={{
                padding: 16,
                borderBottom: '1px solid #e5e7eb',
                alignItems: 'flex-start',
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 1,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>{userName(selectedUser)}</h3>
                <div className="muted small">{roleLabel(selectedUser.role)} · {company?.name ?? 'Компания'}</div>
              </div>
              <button className="ghost" onClick={() => setSelectedUserId(null)}>Закрыть</button>
            </div>

            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
              <Stepper step={step} onStep={setStep} />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {saveM.error ? <div className="alert" style={{ marginBottom: 12 }}>{errorMessage(saveM.error)}</div> : null}

              {step === 1 ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>Сотрудник и базовая роль</h3>
                    <div className="muted small">Роль показана для проверки. В этом мастере она не изменяется.</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                    <CountCard label="Сотрудник" value={userName(selectedUser)} />
                    <CountCard label="Компания" value={company?.name ?? '—'} />
                    <CountCard label="Статус" value={statusLabel(selectedUser)} />
                    <CountCard label="Базовая роль" value={roleLabel(selectedUser.role)} />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>Контур работы</h3>
                    <div className="muted small">Выберите клиентов и объекты, на которых сотрудник должен работать.</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) minmax(0, 1fr)', gap: 14 }}>
                    <div className="panel" style={{ margin: 0 }}>
                      <h4 style={{ marginTop: 0 }}>Клиенты</h4>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(contoursQ.data?.contours ?? []).map((contour) => (
                          <label key={contour.id} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <input
                                type="checkbox"
                                checked={selectedContourIds.includes(contour.id)}
                                onChange={() => toggleContour(contour.id)}
                              />
                              <div>
                                <div style={{ fontWeight: 800 }}>{contourTitle(contour)}</div>
                                <div className="muted small">{contourRoleLabel(contour.role)}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="panel" style={{ margin: 0 }}>
                      <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <h4 style={{ margin: 0 }}>Объекты</h4>
                          <div className="muted small">Выбрано: {selectedLocationCount}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button className="ghost" type="button" onClick={clearLocationScope}>
                            Оставить без объектов
                          </button>
                          <input
                            placeholder="Поиск по названию, городу или адресу"
                            value={locationSearch}
                            onChange={(event) => setLocationSearch(event.target.value)}
                            style={{ maxWidth: 320 }}
                          />
                        </div>
                      </div>
                      {restrictedEmptyRequested ? (
                        <div className="alert" style={{ marginBottom: 10 }}>
                          После сохранения сотрудник не будет видеть рабочие объекты.
                        </div>
                      ) : null}

                      {selectedContourIds.length === 0 ? (
                        <div className="muted small">Сначала выберите клиента.</div>
                      ) : availableLocationsQ.isLoading ? (
                        <div className="muted small">Загружаем объекты...</div>
                      ) : availableLocationsQ.isError ? (
                        <div className="alert">
                          Не удалось загрузить объекты выбранного клиента. Обновите страницу или проверьте доступ к клиентскому контуру.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          {selectedContourIds.map((clientId) => {
                            const contour = contoursQ.data?.contours.find((item) => item.id === clientId)
                            const q = normalizeSearch(locationSearch)
                            const locations = (availableLocationsQ.data ?? [])
                              .filter((location) => location.clientCompanyId === clientId)
                              .filter((location) => {
                                if (!q) return true
                                return normalizeSearch([location.name, location.city, location.address, location.platformCode].join(' ')).includes(q)
                              })
                              .sort((a, b) => `${a.city || ''} ${a.name}`.localeCompare(`${b.city || ''} ${b.name}`))
                            const cities = unique(locations.map((location) => text(location.city) || 'Город не указан'))
                            return (
                              <div key={clientId} style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontWeight: 800 }}>{contour ? contourTitle(contour) : 'Клиент'}</div>
                                {cities.map((city) => (
                                  <div key={city} style={{ display: 'grid', gap: 6 }}>
                                    <div className="muted small" style={{ fontWeight: 800 }}>{city}</div>
                                    {locations
                                      .filter((location) => (text(location.city) || 'Город не указан') === city)
                                      .map((location) => (
                                        <label key={location.id} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, cursor: 'pointer' }}>
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                            <input
                                              type="checkbox"
                                              checked={selectedLocationIds.includes(location.id)}
                                              onChange={() => toggleLocation(location.id)}
                                            />
                                            <div>
                                              <div style={{ fontWeight: 800 }}>{locationTitle(location)}</div>
                                              <div className="muted small">{locationSubtitle(location)}</div>
                                            </div>
                                          </div>
                                        </label>
                                      ))}
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>Дополнительные возможности</h3>
                    <div className="muted small">Базовые возможности идут от роли. Менять можно только индивидуальные добавления.</div>
                  </div>

                  {(Object.keys(domainLabels) as CapabilityDomain[]).map((domain) => {
                    const items = availableCapabilityCodes.map((code) => capabilityMeta(code, catalogQ.data)).filter((item) => item.domain === domain)
                    if (items.length === 0) return null
                    return (
                      <div key={domain} className="panel" style={{ margin: 0 }}>
                        <h4 style={{ marginTop: 0 }}>{domainLabels[domain]}</h4>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {items.map((item) => {
                            const inherited = roleCodesSet.has(item.code)
                            const checked = inherited || draftOverridesSet.has(item.code)
                            return (
                              <label key={item.code} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={inherited}
                                    onChange={() => toggleOverride(item.code)}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                                      {inherited ? <Pill tone="ok">Базовая роль</Pill> : null}
                                      {!inherited && draftOverridesSet.has(item.code) ? <Pill tone="warn">Индивидуально</Pill> : null}
                                      {item.risk ? <Pill tone="danger">Требует внимания</Pill> : null}
                                    </div>
                                    <div className="muted small">{item.description}</div>
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {step === 4 ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>Проверка перед сохранением</h3>
                    <div className="muted small">Проверьте, что сотрудник получит ровно тот доступ, который нужен для работы.</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                    <CountCard label="Рабочие контуры" value={proposedClientCount} />
                    <CountCard label="Объекты" value={proposedLocationCount} />
                    <CountCard label="Возможности" value={effectiveCodesAfterSave.length} />
                    <CountCard label="Рабочий доступ" value={proposedVisibility} />
                  </div>

                  {draftPreviewQ.isFetching ? (
                    <div className="muted small">Проверяем будущий доступ...</div>
                  ) : null}
                  {draftPreviewQ.isError ? (
                    <div className="alert">Не удалось проверить будущий доступ: {errorMessage(draftPreviewQ.error)}</div>
                  ) : null}

                  <div className="panel" style={{ margin: 0 }}>
                    <h4 style={{ marginTop: 0 }}>После сохранения сотрудник сможет</h4>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div>✓ видеть {proposedClientCount} рабочих контуров</div>
                      <div>✓ работать на {proposedLocationCount} объектах</div>
                      {effectiveCodesAfterSave.map((code) => capabilityMeta(code, catalogQ.data)).slice(0, 7).map((item) => (
                        <div key={item.code}>✓ {item.label.toLowerCase()}</div>
                      ))}
                    </div>
                  </div>

                  <div className="panel" style={{ margin: 0 }}>
                    <h4 style={{ marginTop: 0 }}>Не сможет</h4>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {capabilities
                        .filter((item) => !effectiveCodesAfterSave.includes(item.code))
                        .slice(0, 6)
                        .map((item) => (
                          <div key={item.code}>✗ {item.label.toLowerCase()}</div>
                        ))}
                      <div>✗ видеть объекты других подрядчиков вне выбранного контура</div>
                    </div>
                  </div>

                  {warnings.length > 0 ? (
                    <div className="alert">
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Предупреждения</div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        {warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="row" style={{ padding: 16, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
              <button className="ghost" onClick={() => setStep((Math.max(1, step - 1) as WizardStep))} disabled={step === 1}>
                Назад
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {step < 4 ? (
                  <button onClick={() => setStep((Math.min(4, step + 1) as WizardStep))}>Далее</button>
                ) : (
                  <button onClick={openConfirm} disabled={!!saveBlocker || saveM.isPending}>
                    Сохранить доступ
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {showConfirm && selectedUser ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}
          onClick={() => !saveM.isPending && setShowConfirm(false)}
        >
          <div className="panel" style={{ maxWidth: 520, width: '100%' }} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Сохранить доступ?</h3>
            <div className="muted small" style={{ marginBottom: 12 }}>
              Изменения будут применены для сотрудника {userName(selectedUser)}. Это повлияет на то, какие объекты и действия будут доступны.
            </div>
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <div>Рабочие контуры: {proposedClientCount}</div>
              <div>Объекты: {proposedLocationCount}</div>
              <div>Возможности: {effectiveCodesAfterSave.length}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowConfirm(false)} disabled={saveM.isPending}>Отмена</button>
              <button onClick={confirmSave} disabled={saveM.isPending}>
                {saveM.isPending ? 'Сохраняем...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
