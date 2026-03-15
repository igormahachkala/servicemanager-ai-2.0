import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const RoleEnum = z.enum([
  'ADMIN',
  'DISPATCHER',
  'MASTER',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
  'NETWORK_DIRECTOR',
  'STAFF',
])

const CreateUserSchema = z.object({
  email: z.string().email('email: некорректный формат'),
  password: z.string().min(8, 'password: минимум 8 символов'),
  role: RoleEnum,
})

const UpdateUserSchema = z.object({
  email: z.string().email('email: некорректный формат'),
  password: z.string().optional(),
  role: RoleEnum,
  isActive: z.boolean(),
})

function roleLabel(role: api.Role) {
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  return role
}

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function urgencyLabel(urgency?: api.TicketUrgency) {
  if (urgency === 'URGENT') return 'Срочно'
  if (urgency === 'NOT_URGENT') return 'Не срочно'
  return urgency || '—'
}

function statusLabel(status?: api.TicketStatus) {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status || '—'
}

export function EmployeesPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<api.Role>('TECHNICIAN')
  const [selectedSpecIds, setSelectedSpecIds] = useState<string[]>([])

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<api.Role>('TECHNICIAN')
  const [editIsActive, setEditIsActive] = useState(true)

  const [editingTechnicianId, setEditingTechnicianId] = useState<string | null>(null)
  const [editingSpecIds, setEditingSpecIds] = useState<string[]>([])

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: api.users,
  })

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const techniciansQ = useQuery({
    queryKey: ['technicians'],
    queryFn: api.technicians,
  })

  const workloadQ = useQuery({
    queryKey: ['technicians-workload'],
    queryFn: api.techniciansWorkload,
  })

  const specsQ = useQuery({
    queryKey: ['specializations'],
    queryFn: api.specializations,
  })

  useEffect(() => {
    if (role !== 'TECHNICIAN' && selectedSpecIds.length > 0) {
      setSelectedSpecIds([])
    }
  }, [role, selectedSpecIds.length])

  useEffect(() => {
    if (editRole !== 'TECHNICIAN') {
      setEditingTechnicianId(null)
      setEditingSpecIds([])
    }
  }, [editRole])

  const activeSpecs = useMemo(() => {
    const rows = specsQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [specsQ.data])

  const sortedUsers = useMemo(() => {
    const rows = usersQ.data ? [...usersQ.data] : []
    rows.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    return rows
  }, [usersQ.data])

  const currentUserId = meQ.data?.id || null

  const activeAdminCount = useMemo(() => {
    return sortedUsers.filter((user) => user.role === 'ADMIN' && user.isActive !== false).length
  }, [sortedUsers])

  const techniciansMap = useMemo(() => {
    const map = new Map<string, api.TechnicianItem>()
    for (const tech of techniciansQ.data || []) {
      map.set(tech.id, tech)
    }
    return map
  }, [techniciansQ.data])

  const workloadMap = useMemo(() => {
    const map = new Map<string, api.TechnicianWorkloadItem>()
    for (const item of workloadQ.data || []) {
      map.set(item.technicianId, item)
    }
    return map
  }, [workloadQ.data])

  const createM = useMutation({
    mutationFn: async (payload: api.CreateUserInput) => {
      const created = await api.createUser(payload)

      if (payload.role === 'TECHNICIAN' && selectedSpecIds.length > 0) {
        await api.setTechnicianSpecializations(created.id, selectedSpecIds)
      }

      return created
    },
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(
        created.role === 'TECHNICIAN' && selectedSpecIds.length > 0
          ? `Сотрудник ${created.email} создан, специализации назначены`
          : `Сотрудник ${created.email} создан`,
      )

      setEmail('')
      setPassword('')
      setRole('TECHNICIAN')
      setSelectedSpecIds([])

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['technicians'] }),
        qc.invalidateQueries({ queryKey: ['technicians-workload'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const updateM = useMutation({
    mutationFn: async (params: { userId: string; payload: api.UpdateUserInput }) => {
      const updated = await api.updateUser(params.userId, params.payload)

      if (params.payload.role === 'TECHNICIAN') {
        await api.setTechnicianSpecializations(params.userId, editingSpecIds)
      }

      return updated
    },
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Сотрудник ${updated.email} обновлен`)
      cancelEditUser()

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['technicians'] }),
        qc.invalidateQueries({ queryKey: ['technicians-workload'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const toggleUserActiveM = useMutation({
    mutationFn: async (params: { user: api.UserListItem; isActive: boolean }) => {
      return params.isActive ? api.activateUser(params.user.id) : api.deactivateUser(params.user.id)
    },
    onSuccess: async (updated, vars) => {
      setErr(null)
      setSuccess(
        vars.isActive
          ? `User ${updated.email} activated`
          : `User ${updated.email} deactivated`,
      )

      if (editingUserId === vars.user.id) {
        cancelEditUser()
      }
      if (editingTechnicianId === vars.user.id) {
        cancelEditTechnician()
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['technicians'] }),
        qc.invalidateQueries({ queryKey: ['technicians-workload'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const saveTechSpecsM = useMutation({
    mutationFn: async (params: { technicianId: string; specializationIds: string[] }) => {
      return api.setTechnicianSpecializations(params.technicianId, params.specializationIds)
    },
    onSuccess: async () => {
      setErr(null)
      setSuccess('Специализации техника сохранены')
      setEditingTechnicianId(null)
      setEditingSpecIds([])

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['technicians'] }),
        qc.invalidateQueries({ queryKey: ['technicians-workload'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  function toggleNewSpec(id: string) {
    setSelectedSpecIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleEditSpec(id: string) {
    setEditingSpecIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function beginEditUser(user: api.UserListItem) {
    setSuccess(null)
    setErr(null)

    setEditingUserId(user.id)
    setEditEmail(user.email)
    setEditPassword('')
    setEditRole(user.role)
    setEditIsActive(user.isActive !== false)

    if (user.role === 'TECHNICIAN') {
      const tech = techniciansMap.get(user.id)
      setEditingTechnicianId(user.id)
      setEditingSpecIds((tech?.technicianSpecializations || []).map((x) => x.specialization.id))
    } else {
      setEditingTechnicianId(null)
      setEditingSpecIds([])
    }
  }

  function cancelEditUser() {
    setEditingUserId(null)
    setEditEmail('')
    setEditPassword('')
    setEditRole('TECHNICIAN')
    setEditIsActive(true)
    setEditingTechnicianId(null)
    setEditingSpecIds([])
  }

  function beginEditTechnician(tech: api.TechnicianItem) {
    setSuccess(null)
    setErr(null)
    setEditingTechnicianId(tech.id)
    setEditingSpecIds((tech.technicianSpecializations || []).map((x) => x.specialization.id))
  }

  function cancelEditTechnician() {
    setEditingTechnicianId(null)
    setEditingSpecIds([])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()

    const parsed = CreateUserSchema.safeParse({
      email: normalizedEmail,
      password: normalizedPassword,
      role,
    })

    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => i.message).join('\n'))
      return
    }

    createM.mutate(parsed.data)
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUserId) return

    setErr(null)
    setSuccess(null)

    const normalizedEmail = editEmail.trim().toLowerCase()
    const normalizedPassword = editPassword.trim()

    const parsed = UpdateUserSchema.safeParse({
      email: normalizedEmail,
      password: normalizedPassword || undefined,
      role: editRole,
      isActive: editIsActive,
    })

    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => i.message).join('\n'))
      return
    }

    const payload: api.UpdateUserInput = {
      email: parsed.data.email,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    }

    if (normalizedPassword) {
      if (normalizedPassword.length < 8) {
        setErr('password: минимум 8 символов')
        return
      }
      payload.password = normalizedPassword
    }

    updateM.mutate({
      userId: editingUserId,
      payload,
    })
  }

  function handleToggleUser(user: api.UserListItem) {
    const nextIsActive = user.isActive === false
    const isSelf = currentUserId === user.id
    const isLastActiveAdmin = user.role === 'ADMIN' && user.isActive !== false && activeAdminCount <= 1

    if (!nextIsActive && isSelf) {
      setSuccess(null)
      setErr('You cannot deactivate your own account')
      return
    }

    if (!nextIsActive && isLastActiveAdmin) {
      setSuccess(null)
      setErr('Cannot deactivate the last active admin')
      return
    }

    const question = nextIsActive
      ? `Activate user ${user.email}?`
      : `Deactivate user ${user.email}?\n\nThe account will stay in the system, but this user will no longer be able to sign in.`

    const ok = window.confirm(question)
    if (!ok) return

    setErr(null)
    setSuccess(null)

    toggleUserActiveM.mutate({
      user,
      isActive: nextIsActive,
    })
  }

  const isLoading = usersQ.isFetching || techniciansQ.isFetching || specsQ.isFetching || workloadQ.isFetching
  const isCreating = createM.isPending
  const isUpdating = updateM.isPending
  const isSavingSpecs = saveTechSpecsM.isPending
  const isTogglingUser = toggleUserActiveM.isPending

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Сотрудники</h2>
          <div className="muted small">
            {usersQ.isFetching ? 'Загрузка…' : usersQ.data ? `Всего сотрудников: ${usersQ.data.length}` : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="ghost"
            onClick={() => {
              usersQ.refetch()
              techniciansQ.refetch()
              workloadQ.refetch()
              specsQ.refetch()
            }}
            disabled={isLoading || isCreating || isUpdating || isSavingSpecs || isTogglingUser}
          >
            Обновить
          </button>

          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}

      {usersQ.isError ? <div className="alert">{(usersQ.error as any)?.message || String(usersQ.error)}</div> : null}
      {techniciansQ.isError ? (
        <div className="alert">{(techniciansQ.error as any)?.message || String(techniciansQ.error)}</div>
      ) : null}
      {workloadQ.isError ? (
        <div className="alert">{(workloadQ.error as any)?.message || String(workloadQ.error)}</div>
      ) : null}
      {specsQ.isError ? <div className="alert">{(specsQ.error as any)?.message || String(specsQ.error)}</div> : null}

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Загрузка техников</h3>

        {!workloadQ.data || workloadQ.data.length === 0 ? (
          <div className="muted small">Техники пока не найдены.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {workloadQ.data.map((item) => (
              <div key={item.technicianId} className="panel" style={{ marginBottom: 0 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.email}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Активная нагрузка: {item.activeLoad}
                    </div>
                    <div className="muted small">Назначено: {item.assignedCount}</div>
                    <div className="muted small">В работе: {item.inProgressCount}</div>
                    <div className="muted small" style={{ marginTop: 6 }}>
                      Специализации:{' '}
                      {item.specializations.length > 0
                        ? item.specializations.map((x) => x.name).join(', ')
                        : 'не назначены'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Активные заявки</div>

                  {item.tickets.length === 0 ? (
                    <div className="muted small">Активных заявок нет</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {item.tickets.map((ticket) => (
                        <div key={ticket.id} className="ticket" style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="tag">{statusLabel(ticket.status)}</span>
                            <span className="tag">{urgencyLabel(ticket.urgency)}</span>
                          </div>

                          <div className="muted small">Категория: {ticket.category?.name || '—'}</div>
                          <div className="muted small">SLA: {fmt(ticket.slaDueAt)}</div>

                          <div>
                            <Link to={`/tickets/${ticket.id}`}>
                              <button className="ghost">Открыть заявку</button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Добавить сотрудника</h3>

          <form onSubmit={submit} className="form">
            <label>
              Email *
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tech2@company.com"
                disabled={isCreating}
              />
            </label>

            <label>
              Пароль *
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Минимум 8 символов"
                disabled={isCreating}
              />
              <div className="muted small" style={{ marginTop: 6 }}>
                Укажи стартовый пароль сотрудника.
              </div>
            </label>

            <label>
              Роль *
              <select value={role} onChange={(e) => setRole(e.target.value as api.Role)} disabled={isCreating}>
                <option value="ADMIN">Администратор</option>
                <option value="DISPATCHER">Диспетчер</option>
                <option value="MASTER">Мастер</option>
                <option value="TECHNICIAN">Техник</option>
                <option value="CLIENT">Клиент</option>
                <option value="TERRITORIAL_MANAGER">Территориальный менеджер</option>
                <option value="NETWORK_DIRECTOR">Сетевой директор</option>
                <option value="STAFF">Сотрудник</option>
              </select>
            </label>

            {role === 'TECHNICIAN' ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Специализации техника</div>
                {activeSpecs.length === 0 ? (
                  <div className="muted small">Нет активных специализаций</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {activeSpecs.map((spec) => (
                      <label key={spec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedSpecIds.includes(spec.id)}
                          onChange={() => toggleNewSpec(spec.id)}
                          disabled={isCreating}
                        />
                        <span>{spec.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <button disabled={isCreating}>{isCreating ? 'Создание...' : 'Создать сотрудника'}</button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список сотрудников</h3>

          {sortedUsers.length === 0 ? (
            <div className="muted">Сотрудников пока нет</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sortedUsers.map((user) => {
                const tech = techniciansMap.get(user.id)
                const techSpecs = (tech?.technicianSpecializations || []).map((x) => x.specialization.name)
                const workload = workloadMap.get(user.id)
                const isInactive = user.isActive === false
                const isSelf = currentUserId === user.id
                const isLastActiveAdmin = user.role === 'ADMIN' && !isInactive && activeAdminCount <= 1
                const toggleDisabledReason = !isInactive && isSelf
                  ? 'You cannot deactivate your own account'
                  : !isInactive && isLastActiveAdmin
                    ? 'Cannot deactivate the last active admin'
                    : null

                return (
                  <div key={user.id} className="panel" style={{ marginBottom: 0 }}>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{user.email}</div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Роль: {roleLabel(user.role)}
                        </div>
                        <div className="muted small">Status: {isInactive ? 'Inactive' : 'Active'}</div>
                        {toggleDisabledReason ? <div className="muted small">{toggleDisabledReason}</div> : null}
                        <div className="muted small">Создан: {fmt(user.createdAt)}</div>

                        {user.role === 'TECHNICIAN' ? (
                          <>
                            <div className="muted small" style={{ marginTop: 6 }}>
                              Специализации: {techSpecs.length > 0 ? techSpecs.join(', ') : 'не назначены'}
                            </div>
                            <div className="muted small">
                              Нагрузка:{' '}
                              {workload
                                ? `активно ${workload.activeLoad}, назначено ${workload.assignedCount}, в работе ${workload.inProgressCount}`
                                : '—'}
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          className="ghost"
                          onClick={() => beginEditUser(user)}
                          disabled={isUpdating || isSavingSpecs || isTogglingUser}
                        >
                          Редактировать
                        </button>

                        <button
                          className="ghost"
                          onClick={() => handleToggleUser(user)}
                          disabled={isUpdating || isSavingSpecs || isTogglingUser || !!toggleDisabledReason}
                          title={toggleDisabledReason || undefined}
                        >
                          {isInactive ? 'Activate' : 'Deactivate'}
                        </button>

                        {user.role === 'TECHNICIAN' ? (
                          <button
                            className="ghost"
                            onClick={() => beginEditTechnician(tech || { id: user.id, email: user.email, role: user.role })}
                            disabled={isUpdating || isSavingSpecs || isTogglingUser}
                          >
                            Специализации
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {editingUserId === user.id ? (
                      <form onSubmit={submitEdit} className="form" style={{ marginTop: 14 }}>
                        <label>
                          Email
                          <input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            disabled={isUpdating}
                          />
                        </label>

                        <label>
                          Новый пароль
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Оставь пустым, если не менять"
                            disabled={isUpdating}
                          />
                        </label>

                        <label>
                          Роль
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as api.Role)}
                            disabled={isUpdating}
                          >
                            <option value="ADMIN">Администратор</option>
                            <option value="DISPATCHER">Диспетчер</option>
                            <option value="MASTER">Мастер</option>
                            <option value="TECHNICIAN">Техник</option>
                            <option value="CLIENT">Клиент</option>
                            <option value="TERRITORIAL_MANAGER">Территориальный менеджер</option>
                            <option value="NETWORK_DIRECTOR">Сетевой директор</option>
                            <option value="STAFF">Сотрудник</option>
                          </select>
                        </label>

                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                            disabled={isUpdating}
                          />
                          <span>Аккаунт активен</span>
                        </label>

                        {editRole === 'TECHNICIAN' ? (
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Специализации техника</div>
                            {activeSpecs.length === 0 ? (
                              <div className="muted small">Нет активных специализаций</div>
                            ) : (
                              <div style={{ display: 'grid', gap: 8 }}>
                                {activeSpecs.map((spec) => (
                                  <label key={spec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={editingSpecIds.includes(spec.id)}
                                      onChange={() => toggleEditSpec(spec.id)}
                                      disabled={isUpdating}
                                    />
                                    <span>{spec.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button disabled={isUpdating}>{isUpdating ? 'Сохранение...' : 'Сохранить'}</button>
                          <button type="button" className="ghost" onClick={cancelEditUser} disabled={isUpdating}>
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {editingTechnicianId === user.id && editingUserId !== user.id ? (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Специализации техника</div>

                        {activeSpecs.length === 0 ? (
                          <div className="muted small">Нет активных специализаций</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                            {activeSpecs.map((spec) => (
                              <label key={spec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={editingSpecIds.includes(spec.id)}
                                  onChange={() => toggleEditSpec(spec.id)}
                                  disabled={isSavingSpecs}
                                />
                                <span>{spec.name}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            disabled={isSavingSpecs}
                            onClick={() =>
                              saveTechSpecsM.mutate({
                                technicianId: user.id,
                                specializationIds: editingSpecIds,
                              })
                            }
                          >
                            {isSavingSpecs ? 'Сохранение...' : 'Сохранить специализации'}
                          </button>

                          <button
                            type="button"
                            className="ghost"
                            onClick={cancelEditTechnician}
                            disabled={isSavingSpecs}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
