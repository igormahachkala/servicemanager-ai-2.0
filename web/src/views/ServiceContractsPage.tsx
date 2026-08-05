import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

type ContractFormValue = {
  clientCompanyId: string
  providerCompanyId: string
  status: api.ServiceContractStatus
  role: api.ServiceContractRole
  startsAt: string
  endsAt: string
  notes: string
  locationIds: string[]
}

const emptyForm: ContractFormValue = {
  clientCompanyId: '',
  providerCompanyId: '',
  status: 'ACTIVE',
  role: 'PRIMARY',
  startsAt: '',
  endsAt: '',
  notes: '',
  locationIds: [],
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('ru-RU')
  } catch {
    return value
  }
}

export function ServiceContractsPage() {
  const qc = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const companiesQ = useQuery({
    queryKey: ['platform-companies'],
    queryFn: api.companies,
    enabled: meQ.data?.role === 'PLATFORM_ADMIN',
  })
  const contractsQ = useQuery({
    queryKey: ['service-contracts'],
    queryFn: api.serviceContracts,
    enabled: meQ.data?.role === 'PLATFORM_ADMIN',
  })

  const [form, setForm] = useState<ContractFormValue>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clientCompanies = useMemo(() => (companiesQ.data || []).filter((company) => company.type === 'CLIENT'), [companiesQ.data])
  const providerCompanies = useMemo(() => (companiesQ.data || []).filter((company) => company.type === 'PROVIDER'), [companiesQ.data])
  const locationsQ = useQuery({
    queryKey: ['service-contract-locations', form.clientCompanyId],
    queryFn: () => api.locations(form.clientCompanyId),
    enabled: meQ.data?.role === 'PLATFORM_ADMIN' && !!form.clientCompanyId,
  })

  const createM = useMutation({
    mutationFn: async () =>
      api.createServiceContract({
        clientCompanyId: form.clientCompanyId,
        providerCompanyId: form.providerCompanyId,
        status: form.status,
        role: form.role,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        notes: form.notes.trim() || undefined,
        locationIds: form.locationIds,
      }),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Связь клиент ↔ подрядчик создана')
      setForm(emptyForm)
      await qc.invalidateQueries({ queryKey: ['service-contracts'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Связь не выбрана')
      return api.updateServiceContract(editingId, {
        status: form.status,
        role: form.role,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        notes: form.notes.trim() || null,
        locationIds: form.locationIds,
      })
    },
    onSuccess: async () => {
      setErr(null)
      setSuccess('Связь обновлена')
      setEditingId(null)
      setForm(emptyForm)
      await qc.invalidateQueries({ queryKey: ['service-contracts'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  if (meQ.isLoading) return <div className="panel">Проверяем доступ...</div>
  if (meQ.data?.role !== 'PLATFORM_ADMIN') return <Navigate to={api.getHomeRoute(meQ.data?.role)} replace />

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)

    if (!form.clientCompanyId) return setErr('Выберите клиентскую компанию')
    if (!form.providerCompanyId) return setErr('Выберите подрядчика')

    if (editingId) updateM.mutate()
    else createM.mutate()
  }

  function startEdit(contract: api.ServiceContractItem) {
    setEditingId(contract.id)
    setForm({
      clientCompanyId: contract.clientCompany.id,
      providerCompanyId: contract.providerCompany.id,
      status: contract.status,
      role: contract.role,
      startsAt: contract.startsAt ? contract.startsAt.slice(0, 10) : '',
      endsAt: contract.endsAt ? contract.endsAt.slice(0, 10) : '',
      notes: contract.notes || '',
      locationIds: (contract.locations || []).map((row) => row.locationId),
    })
    setErr(null)
    setSuccess(null)
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Связи клиент ↔ подрядчик</h2>
          <div className="muted small">Phase B foundation: provider visibility определяется активным контрактом и его ролью, а не просто tenant-ролью.</div>
        </div>
        <Link to="/companies"><button className="ghost">К компаниям</button></Link>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {contractsQ.isError ? <div className="alert">{(contractsQ.error as any)?.message || String(contractsQ.error)}</div> : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>{editingId ? 'Редактировать связь' : 'Создать связь'}</h3>
          <form className="form" onSubmit={submit}>
            <label>
              Клиентская компания
              <select value={form.clientCompanyId} onChange={(e) => setForm((current) => ({ ...current, clientCompanyId: e.target.value }))} disabled={!!editingId}>
                <option value="">Выберите CLIENT компанию</option>
                {clientCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>

            <label>
              Подрядчик
              <select value={form.providerCompanyId} onChange={(e) => setForm((current) => ({ ...current, providerCompanyId: e.target.value }))} disabled={!!editingId}>
                <option value="">Выберите PROVIDER компанию</option>
                {providerCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>

            <label>
              Роль связи
              <select value={form.role} onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as api.ServiceContractRole }))}>
                <option value="PRIMARY">PRIMARY</option>
                <option value="SECONDARY">SECONDARY</option>
              </select>
            </label>

            <label>
              Статус
              <select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as api.ServiceContractStatus }))}>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ENDED">ENDED</option>
              </select>
            </label>

            <label>
              Действует с
              <input type="date" value={form.startsAt} onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))} />
            </label>

            <label>
              Действует до
              <input type="date" value={form.endsAt} onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))} />
            </label>

            <label>
              Заметки
              <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={4} />
            </label>

            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <legend>Объекты договора</legend>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Если ничего не выбрано, договор действует на все объекты клиента.
              </div>
              {locationsQ.isLoading ? <div className="muted small">Загрузка объектов…</div> : null}
              <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {(locationsQ.data || []).map((location) => (
                  <label key={location.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.locationIds.includes(location.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        locationIds: event.target.checked
                          ? [...current.locationIds, location.id]
                          : current.locationIds.filter((id) => id !== location.id),
                      }))}
                    />
                    <span>{location.name}{location.address ? ` — ${location.address}` : ''}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={createM.isPending || updateM.isPending}>{createM.isPending || updateM.isPending ? 'Сохраняем...' : editingId ? 'Сохранить' : 'Создать связь'}</button>
              {editingId ? <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Отмена</button> : null}
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>Подсказка</h3>
          <div className="muted small" style={{ lineHeight: 1.6 }}>
            PRIMARY подрядчик получает расширенную operational visibility по активному клиенту. SECONDARY подрядчик остаётся в ограниченном режиме и не видит весь клиентский поток.
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Текущие связи</h3>
          <div className="muted small">Связей: {(contractsQ.data || []).length}</div>
        </div>

        {contractsQ.isLoading ? <div className="muted small">Загрузка связей...</div> : null}
        {!contractsQ.isLoading && !(contractsQ.data || []).length ? <div className="muted small">Связей пока нет</div> : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {(contractsQ.data || []).map((contract) => (
            <div key={contract.id} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{contract.clientCompany.name} → {contract.providerCompany.name}</div>
                  <div className="muted small">{contract.clientCompany.type} → {contract.providerCompany.type}</div>
                  <div className="muted small">Статус: {contract.status}</div>
                  <div className="muted small">Роль: {contract.role}</div>
                  <div className="muted small">Срок: {formatDate(contract.startsAt)} — {formatDate(contract.endsAt)}</div>
                  <div className="muted small">
                    Объекты: {contract.locations?.length ? contract.locations.map((row) => row.location.name).join(', ') : 'все объекты клиента'}
                  </div>
                  {contract.notes ? <div className="muted small" style={{ marginTop: 6 }}>{contract.notes}</div> : null}
                </div>
                <button type="button" className="ghost" onClick={() => startEdit(contract)}>Редактировать</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
