import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { EmployeeForm, type EmployeeFormValue } from '../components/employees/EmployeeForm'
import { EmployeeList } from '../components/employees/EmployeeList'

const emptyCreateForm: EmployeeFormValue = {
  firstName: '',
  lastName: '',
  profilePhotoUrl: '',
  email: '',
  password: '',
  role: 'TECHNICIAN',
  isActive: true,
  specializationIds: [],
}

const emptyEditForm: EmployeeFormValue = {
  firstName: '',
  lastName: '',
  profilePhotoUrl: '',
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
  return validateUrl(value.profilePhotoUrl)
}

function validateEditForm(value: EmployeeFormValue) {
  if (!normalizeEmail(value.email)) return 'Email обязателен'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value.email))) return 'Некорректный формат email'
  if (value.password.trim() && value.password.trim().length < 8) return 'Пароль должен содержать минимум 8 символов'
  return validateUrl(value.profilePhotoUrl)
}

export function EmployeesPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createValue, setCreateValue] = useState<EmployeeFormValue>(emptyCreateForm)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<EmployeeFormValue>(emptyEditForm)

  const usersQ = useQuery({ queryKey: ['users'], queryFn: api.users })
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const specsQ = useQuery({ queryKey: ['specializations'], queryFn: api.specializations })

  const activeSpecializations = useMemo(
    () => (specsQ.data || []).filter((item) => item.isActive !== false),
    [specsQ.data],
  )

  const sortedUsers = useMemo(() => {
    const rows = [...(usersQ.data || [])]
    rows.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b), 'ru'))
    return rows
  }, [usersQ.data])

  const activeAdminCount = useMemo(
    () => sortedUsers.filter((user) => user.role === 'ADMIN' && user.isActive !== false).length,
    [sortedUsers],
  )

  const createM = useMutation({
    mutationFn: async (value: EmployeeFormValue) => {
      const created = await api.createUser({
        firstName: normalizeText(value.firstName) || undefined,
        lastName: normalizeText(value.lastName) || undefined,
        profilePhotoUrl: normalizeText(value.profilePhotoUrl) || undefined,
        email: normalizeEmail(value.email),
        password: value.password.trim(),
        role: value.role,
      })

      if (value.role === 'TECHNICIAN') {
        await api.updateUserSpecializations(created.id, value.specializationIds)
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
        profilePhotoUrl: normalizeText(params.value.profilePhotoUrl) || undefined,
        email: normalizeEmail(params.value.email),
        password: params.value.password.trim() || undefined,
        role: params.value.role,
        isActive: params.value.isActive,
      })

      if (params.value.role === 'TECHNICIAN') {
        await api.updateUserSpecializations(params.userId, params.value.specializationIds)
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
    setErr(null)
    setSuccess(null)
    setEditingUserId(user.id)
    setEditValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      profilePhotoUrl: user.profilePhotoUrl || '',
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive !== false,
      specializationIds: (user.technicianSpecializations || []).map((item) => item.specialization.id),
    })
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditValue(emptyEditForm)
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
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
    if (!editingUserId) return
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

  const busy = createM.isPending || updateM.isPending || toggleActiveM.isPending

  return (
    <div>
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
              specsQ.refetch()
            }}
            disabled={busy}
          >
            Обновить
          </button>
          <Link to="/board"><button className="ghost">К доске</button></Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {usersQ.isError ? <div className="alert">{(usersQ.error as any)?.message || String(usersQ.error)}</div> : null}
      {specsQ.isError ? <div className="alert">{(specsQ.error as any)?.message || String(specsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="panel">
          <EmployeeForm
            title="Добавить сотрудника"
            submitLabel="Создать сотрудника"
            value={createValue}
            activeSpecializations={activeSpecializations}
            submitting={createM.isPending}
            passwordRequired
            onChange={patchCreate}
            onToggleSpecialization={toggleCreateSpecialization}
            onSubmit={submitCreate}
          />
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список сотрудников</h3>
          {usersQ.isLoading ? (
            <div className="muted">Загружаем сотрудников…</div>
          ) : (
            <EmployeeList
              users={sortedUsers}
              currentUserId={meQ.data?.id || null}
              activeAdminCount={activeAdminCount}
              activeSpecializations={activeSpecializations}
              editingUserId={editingUserId}
              editingValue={editValue}
              busy={busy}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onEditChange={patchEdit}
              onToggleEditSpecialization={toggleEditSpecialization}
              onSubmitEdit={submitEdit}
              onToggleActive={toggleActive}
            />
          )}
        </div>
      </div>
    </div>
  )
}
