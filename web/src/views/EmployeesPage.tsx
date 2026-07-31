import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { EmployeeForm, type EmployeeFormValue } from '../components/employees/EmployeeForm'
import { EmployeeList } from '../components/employees/EmployeeList'

const emptyCreateForm: EmployeeFormValue = {
  firstName: '',
  lastName: '',
  avatarUrl: '',
  phone: '',
  email: '',
  password: '',
  role: 'TECHNICIAN',
  isActive: true,
  specializationIds: [],
}

const emptyEditForm: EmployeeFormValue = {
  firstName: '',
  lastName: '',
  avatarUrl: '',
  phone: '',
  email: '',
  password: '',
  role: 'TECHNICIAN',
  isActive: true,
  specializationIds: [],
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeText(value: string) {
  return value.trim()
}

/** Убирает id деактивированных/чужих специализаций, чтобы PUT /users/:id/specializations не падал на isActive=true. */
function sanitizeTechnicianSpecializationIds(
  ids: string[],
  activeSpecs: api.SpecializationListItem[] | undefined,
): string[] {
  if (!activeSpecs?.length) return ids
  const allowed = new Set(activeSpecs.filter((s) => s.isActive !== false).map((s) => s.id))
  return ids.filter((id) => allowed.has(id))
}

function displayLabel(user: Pick<api.UserListItem, 'firstName' | 'lastName' | 'email'>) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function validateUrl(value: string) {
  const normalized = value.trim()
  if (!normalized) return null
  try {
    new URL(normalized)
    return null
  } catch {
    return 'URL фото должен быть корректной ссылкой'
  }
}

function validateCreateForm(value: EmployeeFormValue) {
  if (!normalizeEmail(value.email)) return 'Email обязателен'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value.email))) return 'Некорректный формат email'
  if (value.password.trim().length < 8) return 'Пароль должен содержать минимум 8 символов'
  return validateUrl(value.avatarUrl)
}

function validateEditForm(value: EmployeeFormValue) {
  if (!normalizeEmail(value.email)) return 'Email обязателен'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value.email))) return 'Некорректный формат email'
  if (value.password.trim() && value.password.trim().length < 8) return 'Пароль должен содержать минимум 8 символов'
  return validateUrl(value.avatarUrl)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const LOCATION_BINDABLE_ROLES: api.Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
  'NETWORK_DIRECTOR',
]

export function EmployeesPage() {
  const qc = useQueryClient()
  const location = useLocation()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createValue, setCreateValue] = useState<EmployeeFormValue>(emptyCreateForm)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<EmployeeFormValue>(emptyEditForm)
  const [bindingsScopeCompanyId, setBindingsScopeCompanyId] = useState('')
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const requestedCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId') || '').trim()
  }, [location.search])
  const observerCompanyId = meQ.data?.role === 'PLATFORM_ADMIN' ? requestedCompanyId : ''
  const isObserverMode = !!observerCompanyId && observerCompanyId !== meQ.data?.companyId

  const observerCompanyQ = useQuery({
    queryKey: ['observer-company', observerCompanyId],
    queryFn: () => api.company(observerCompanyId),
    enabled: !!observerCompanyId && meQ.data?.role === 'PLATFORM_ADMIN',
  })
  const ownCompanyQ = useQuery({
    queryKey: ['own-company'],
    queryFn: () => api.company(),
    enabled: !isObserverMode,
  })
  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients-for-bindings'],
    queryFn: api.getLinkedClients,
    enabled: !isObserverMode && ownCompanyQ.data?.type === 'PROVIDER',
  })

  const usersQ = useQuery({ queryKey: ['users', observerCompanyId, showDeleted], queryFn: () => api.users(observerCompanyId || undefined, { includeDeleted: showDeleted }) })
  const specsQ = useQuery({ queryKey: ['specializations'], queryFn: api.specializations, enabled: !isObserverMode })

  const activeSpecializations = useMemo(
    () => (specsQ.data || []).filter((item) => item.isActive !== false),
    [specsQ.data],
  )

  const tenantCompanyType = observerCompanyQ.data?.type ?? ownCompanyQ.data?.type

  const sortedUsers = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    let rows = [...(usersQ.data || [])]
    if (q) {
      rows = rows.filter((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase()
        return (
          u.email.toLowerCase().includes(q) ||
          name.includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
        )
      })
    }
    rows.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b), 'ru'))
    return rows
  }, [usersQ.data, searchQ])

  const activeAdminCount = useMemo(
    () => sortedUsers.filter((user) => user.role === 'ADMIN' && user.isActive !== false).length,
    [sortedUsers],
  )
  const isEditingLocationBoundRole = !!editingUserId && LOCATION_BINDABLE_ROLES.includes(editValue.role)
  const providerLinkedClientOptions = useMemo(
    () =>
      (linkedClientsQ.data || [])
        .filter((item) => item.status === 'ACTIVE')
        .map((item) => ({ id: item.clientCompany.id, name: item.clientCompany.name })),
    [linkedClientsQ.data],
  )
  const effectiveBindingsCompanyId = useMemo(() => {
    if (!isEditingLocationBoundRole) return ''
    if (isObserverMode) return observerCompanyId
    if (ownCompanyQ.data?.type === 'PROVIDER') return bindingsScopeCompanyId
    return meQ.data?.companyId || ''
  }, [isEditingLocationBoundRole, isObserverMode, observerCompanyId, ownCompanyQ.data?.type, bindingsScopeCompanyId, meQ.data?.companyId])
  const bindingsQ = useQuery({
    queryKey: ['technician-location-bindings', editingUserId, effectiveBindingsCompanyId],
    queryFn: () =>
      api.getTechnicianLocationBindings(editingUserId!, {
        companyId: effectiveBindingsCompanyId || undefined,
      }),
    enabled: !!editingUserId && isEditingLocationBoundRole && !!effectiveBindingsCompanyId,
  })

  useEffect(() => {
    if (!isEditingLocationBoundRole) {
      setBindingsScopeCompanyId('')
      setSelectedLocationIds([])
      return
    }
    if (isObserverMode) {
      setBindingsScopeCompanyId(observerCompanyId)
      return
    }
    if (ownCompanyQ.data?.type === 'PROVIDER') {
      if (providerLinkedClientOptions.length === 0) {
        setBindingsScopeCompanyId('')
        return
      }
      if (!providerLinkedClientOptions.some((item) => item.id === bindingsScopeCompanyId)) {
        setBindingsScopeCompanyId(providerLinkedClientOptions[0].id)
      }
      return
    }
    setBindingsScopeCompanyId(meQ.data?.companyId || '')
  }, [
    isEditingLocationBoundRole,
    isObserverMode,
    observerCompanyId,
    ownCompanyQ.data?.type,
    providerLinkedClientOptions,
    bindingsScopeCompanyId,
    meQ.data?.companyId,
  ])

  // Single effect: load from cache when data exists, clear when scope changes before data loads.
  // Merged from two effects to prevent the clear (B) from racing and overwriting the load (A)
  // in the same render cycle when bindingsQ has cached data and effectiveBindingsCompanyId changes.
  useEffect(() => {
    if (!isEditingLocationBoundRole) return
    if (bindingsQ.data) {
      setSelectedLocationIds(bindingsQ.data.locationIds || [])
    } else {
      setSelectedLocationIds([])
    }
  }, [isEditingLocationBoundRole, effectiveBindingsCompanyId, bindingsQ.data])

  useEffect(() => {
    if (!editingUserId || !specsQ.data?.length) return
    setEditValue((prev) => ({
      ...prev,
      specializationIds: sanitizeTechnicianSpecializationIds(prev.specializationIds, specsQ.data),
    }))
  }, [editingUserId, specsQ.data])

  const createM = useMutation({
    mutationFn: async (value: EmployeeFormValue) => {
      const created = await api.createUser({
        firstName: normalizeText(value.firstName) || undefined,
        lastName: normalizeText(value.lastName) || undefined,
        avatarUrl: normalizeText(value.avatarUrl) || undefined,
        phone: normalizeText(value.phone) || undefined,
        email: normalizeEmail(value.email),
        password: value.password.trim(),
        role: value.role,
      })

      if (value.role === 'TECHNICIAN') {
        const specIds = sanitizeTechnicianSpecializationIds(value.specializationIds, specsQ.data)
        await api.updateUserSpecializations(created.id, specIds)
      }

      return created
    },
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Сотрудник ${displayLabel(created)} создан`)
      setCreateValue(emptyCreateForm)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const updateM = useMutation({
    mutationFn: async (params: { userId: string; value: EmployeeFormValue }) => {
      const updated = await api.updateUser(params.userId, {
        firstName: normalizeText(params.value.firstName) || undefined,
        lastName: normalizeText(params.value.lastName) || undefined,
        avatarUrl: normalizeText(params.value.avatarUrl) || undefined,
        phone: normalizeText(params.value.phone) || undefined,
        email: normalizeEmail(params.value.email),
        password: params.value.password.trim() || undefined,
        role: params.value.role,
        isActive: params.value.isActive,
      })

      if (params.value.role === 'TECHNICIAN') {
        const specIds = sanitizeTechnicianSpecializationIds(params.value.specializationIds, specsQ.data)
        await api.updateUserSpecializations(params.userId, specIds)
      }

      return updated
    },
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Сотрудник ${displayLabel(updated)} обновлён`)
      setEditingUserId(null)
      setEditValue(emptyEditForm)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const toggleActiveM = useMutation({
    mutationFn: async (user: api.UserListItem) => {
      return user.isActive === false ? api.activateUser(user.id) : api.deactivateUser(user.id)
    },
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Сотрудник ${displayLabel(updated)} ${updated.isActive === false ? 'активирован' : 'деактивирован'}`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ])
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })
  const deleteM = useMutation({
    mutationFn: (user: api.UserListItem) => api.deleteUser(user.id),
    onSuccess: async (deleted) => {
      setErr(null)
      setSuccess(`Сотрудник ${displayLabel(deleted)} удалён`)
      if (editingUserId === deleted.id) {
        setEditingUserId(null)
        setEditValue(emptyEditForm)
      }
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const restoreM = useMutation({
    mutationFn: (user: api.UserListItem) => api.restoreUser(user.id),
    onSuccess: async (restored) => {
      setErr(null)
      setSuccess(`Сотрудник ${displayLabel(restored)} восстановлен`)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const saveBindingsM = useMutation({
    mutationFn: async () => {
      if (!editingUserId || !isEditingLocationBoundRole) {
        throw new Error('Сначала выберите сотрудника с ролью, поддерживающей location binding')
      }
      const scopeCompanyId = (effectiveBindingsCompanyId || bindingsQ.data?.companyId || '').trim()
      const payload: { companyId?: string; locationIds: string[] } = { locationIds: visibleSelectedLocationIds }
      if (scopeCompanyId && isUuid(scopeCompanyId)) payload.companyId = scopeCompanyId
      return api.setTechnicianLocationBindings(editingUserId, payload)
    },
    onSuccess: async () => {
      setErr(null)
      setSuccess('Доступные точки сохранены')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['technician-location-bindings', editingUserId, effectiveBindingsCompanyId] }),
      ])
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  function patchCreate(patch: Partial<EmployeeFormValue>) {
    setCreateValue((current) => {
      const next = { ...current, ...patch }
      if (next.role !== 'TECHNICIAN') next.specializationIds = []
      return next
    })
  }

  function patchEdit(patch: Partial<EmployeeFormValue>) {
    setEditValue((current) => {
      const next = { ...current, ...patch }
      if (next.role !== 'TECHNICIAN') next.specializationIds = []
      return next
    })
  }

  function toggleCreateSpecialization(specializationId: string) {
    patchCreate({
      specializationIds: createValue.specializationIds.includes(specializationId)
        ? createValue.specializationIds.filter((id) => id !== specializationId)
        : [...createValue.specializationIds, specializationId],
    })
  }

  function toggleEditSpecialization(specializationId: string) {
    patchEdit({
      specializationIds: editValue.specializationIds.includes(specializationId)
        ? editValue.specializationIds.filter((id) => id !== specializationId)
        : [...editValue.specializationIds, specializationId],
    })
  }

  function beginEdit(user: api.UserListItem) {
    if (isObserverMode) return
    setErr(null)
    setSuccess(null)
    setEditingUserId(user.id)
    setEditValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.avatarUrl || '',
      phone: user.phone || '',
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive !== false,
      specializationIds: sanitizeTechnicianSpecializationIds(
        (user.technicianSpecializations || []).map((item) => item.specialization.id),
        specsQ.data,
      ),
    })
    setSelectedLocationIds([])
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditValue(emptyEditForm)
    setBindingsScopeCompanyId('')
    setSelectedLocationIds([])
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    if (isObserverMode) return
    setErr(null)
    setSuccess(null)
    const validationError = validateCreateForm(createValue)
    if (validationError) {
      setErr(validationError)
      return
    }
    createM.mutate(createValue)
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingUserId || isObserverMode) return
    setErr(null)
    setSuccess(null)
    const validationError = validateEditForm(editValue)
    if (validationError) {
      setErr(validationError)
      return
    }
    updateM.mutate({ userId: editingUserId, value: editValue })
  }

  function toggleActive(user: api.UserListItem) {
    if (isObserverMode) return
    const isSelf = meQ.data?.id === user.id
    const isLastAdmin = user.role === 'ADMIN' && user.isActive !== false && activeAdminCount <= 1

    if (user.isActive !== false && isSelf) {
      setSuccess(null)
      setErr('Нельзя деактивировать собственный аккаунт')
      return
    }

    if (user.isActive !== false && isLastAdmin) {
      setSuccess(null)
      setErr('Нельзя деактивировать последнего активного администратора')
      return
    }

    toggleActiveM.mutate(user)
  }

  function deleteEmployee(user: api.UserListItem) {
    if (isObserverMode) return
    if (!window.confirm(`Удалить сотрудника ${displayLabel(user)}? Это действие можно отменить через восстановление.`)) return
    deleteM.mutate(user)
  }

  function restoreEmployee(user: api.UserListItem) {
    if (isObserverMode) return
    restoreM.mutate(user)
  }

  function toggleLocation(locationId: string) {
    setSelectedLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    )
  }

  const busy = createM.isPending || updateM.isPending || toggleActiveM.isPending || deleteM.isPending || restoreM.isPending
  const bindingsBusy = bindingsQ.isFetching || saveBindingsM.isPending
  const observerLabel = observerCompanyQ.data?.name || observerCompanyId
  const providerHasNoLinkedClients =
    !isObserverMode &&
    ownCompanyQ.data?.type === 'PROVIDER' &&
    !linkedClientsQ.isFetching &&
    providerLinkedClientOptions.length === 0
  const bindingsAvailableLocations = bindingsQ.data?.availableLocations || []
  // Only IDs that are currently visible in the available list — prevents stale/inactive IDs in save payload.
  const visibleSelectedLocationIds = useMemo(() => {
    const availableIds = new Set(bindingsAvailableLocations.map((l) => l.id))
    return selectedLocationIds.filter((id) => availableIds.has(id))
  }, [selectedLocationIds, bindingsAvailableLocations])
  const bindingsHasChanges = useMemo(() => {
    if (!bindingsQ.data) return false
    const current = new Set(bindingsQ.data.locationIds || [])
    const next = new Set(visibleSelectedLocationIds)
    if (current.size !== next.size) return true
    for (const id of current) {
      if (!next.has(id)) return true
    }
    return false
  }, [bindingsQ.data, visibleSelectedLocationIds])
  const technicianLocationBindingsBlock = isEditingLocationBoundRole ? (
    <div className="panel uiCard" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>Доступные точки</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Управление location-scope для роли {editValue.role}. Пустой список закрывает доступ к точкам до выбора разрешённых объектов.
      </div>
      <div className="fieldHint" style={{ marginBottom: 10 }}>
        Отметьте точки, куда сотрудник может ездить. Для подрядчика сначала выберите клиентский контур — список точек подгрузится для
        этого клиента.
      </div>
      {ownCompanyQ.data?.type === 'PROVIDER' && !isObserverMode ? (
        <label>
          Клиентский контур
          <select
            value={bindingsScopeCompanyId}
            onChange={(e) => setBindingsScopeCompanyId(e.target.value)}
            disabled={bindingsBusy || providerLinkedClientOptions.length === 0}
          >
            {providerLinkedClientOptions.length === 0 ? <option value="">Нет доступных linked clients</option> : null}
            {providerLinkedClientOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {providerHasNoLinkedClients ? (
        <div className="muted small">
          Нет linked client контуров с PRIMARY доступом. Привязка точек недоступна.
        </div>
      ) : null}
      {!providerHasNoLinkedClients && !effectiveBindingsCompanyId ? (
        <div className="muted small">
          Выберите контур компании для загрузки доступных точек.
        </div>
      ) : null}
      {!providerHasNoLinkedClients && effectiveBindingsCompanyId ? (
        <>
          {bindingsQ.isLoading ? <div className="muted small">Загружаем доступные точки…</div> : null}
          {bindingsQ.isError ? (
            <div className="alert">{(bindingsQ.error as any)?.message || String(bindingsQ.error)}</div>
          ) : null}
          {!bindingsQ.isLoading && !bindingsQ.isError ? (
            <>
              {bindingsAvailableLocations.length === 0 ? (
                <div className="muted small">
                  Backend не вернул доступных точек в текущем контуре. Проверьте связи и права доступа.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                  {bindingsAvailableLocations.map((location) => (
                    <label key={location.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedLocationIds.includes(location.id)}
                        onChange={() => toggleLocation(location.id)}
                        disabled={bindingsBusy}
                      />
                      <span>{[location.name, location.city, location.address].filter(Boolean).join(' · ')}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="muted small" style={{ marginBottom: 10 }}>
                {visibleSelectedLocationIds.length > 0
                  ? `Выбрано точек: ${visibleSelectedLocationIds.length}`
                  : 'Точки не выбраны: после сохранения доступ к точкам будет закрыт.'}
              </div>
              {!bindingsHasChanges ? (
                <div className="muted small" style={{ marginBottom: 10 }}>
                  Изменений нет, но вы можете сохранить текущие привязки повторно.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => saveBindingsM.mutate()}
                disabled={bindingsBusy || bindingsQ.isLoading || !!bindingsQ.isError}
              >
                {saveBindingsM.isPending ? 'Сохраняем…' : 'Сохранить точки'}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  ) : null

  return (
    <div className="managementPage">
      <div className="managementPageContext">
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Сотрудники</h2>
          <div className="muted small">
            {usersQ.isFetching ? 'Загрузка…' : `Сотрудников: ${sortedUsers.length}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="ghost"
            onClick={() => {
              usersQ.refetch()
              if (!isObserverMode) specsQ.refetch()
              if (!isObserverMode) ownCompanyQ.refetch()
              if (!isObserverMode && ownCompanyQ.data?.type === 'PROVIDER') linkedClientsQ.refetch()
            }}
            disabled={busy}
          >
            Обновить
          </button>
          <Link to={observerCompanyId ? `/company?companyId=${observerCompanyId}` : '/company'}><button className="ghost">К компании</button></Link>
          <Link to={observerCompanyId ? `/board?companyId=${observerCompanyId}` : '/board'}><button className="ghost">К доске</button></Link>
        </div>
      </div>

      <div className="managementContextControls">
        <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Показать удалённых
        </label>
        <input
          type="search"
          placeholder="Поиск: имя, email, телефон"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ flex: '1 1 260px', maxWidth: 420 }}
        />
      </div>
      </div>

      <div className="pageHint">
        Здесь создаются сотрудники и назначаются роли, специализации и доступные точки.
      </div>

      {isObserverMode ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Режим просмотра компании: {observerLabel}</div>
          <div className="muted small">PLATFORM_ADMIN просматривает сотрудников компании без cross-tenant изменений.</div>
        </div>
      ) : null}

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {usersQ.isError ? <div className="alert">{(usersQ.error as any)?.message || String(usersQ.error)}</div> : null}
      {observerCompanyQ.isError ? <div className="alert">{(observerCompanyQ.error as any)?.message || String(observerCompanyQ.error)}</div> : null}
      {!isObserverMode && specsQ.isError ? <div className="alert">{(specsQ.error as any)?.message || String(specsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="panel">
          {isObserverMode ? (
            <div className="muted small">Создание сотрудников отключено в режиме наблюдателя. Для изменений войдите в контур самой компании.</div>
          ) : (
            <EmployeeForm
              title="Добавить сотрудника"
              submitLabel="Создать сотрудника"
              value={createValue}
              activeSpecializations={activeSpecializations}
              companyType={tenantCompanyType}
              submitting={createM.isPending}
              passwordRequired
              onChange={patchCreate}
              onToggleSpecialization={toggleCreateSpecialization}
              onSubmit={submitCreate}
            />
          )}
        </div>

        <div className="panel">
          <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Список сотрудников</h3>
          </div>
          {usersQ.isLoading ? (
            <div className="muted">Загружаем сотрудников…</div>
          ) : (
            <EmployeeList
              users={sortedUsers}
              currentUserId={meQ.data?.id || null}
              activeAdminCount={activeAdminCount}
              activeSpecializations={activeSpecializations}
              companyType={tenantCompanyType}
              editingUserId={editingUserId}
              editingValue={editValue}
              busy={busy || isObserverMode}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onEditChange={patchEdit}
              onToggleEditSpecialization={toggleEditSpecialization}
              onSubmitEdit={submitEdit}
              onToggleActive={toggleActive}
              onDelete={deleteEmployee}
              onRestore={restoreEmployee}
              editExtras={technicianLocationBindingsBlock}
            />
          )}
        </div>
      </div>
    </div>
  )
}
