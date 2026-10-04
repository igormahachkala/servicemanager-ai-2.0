import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  ManagerIssueMaterialForm,
  MaterialMovementsList,
  MaterialsBalanceList,
  SelfPurchaseForm,
  StockReceiptForm,
} from '../components/materials/MaterialsPanels'
import {
  activeMaterials,
  formatMaterialQuantity,
  normalizeMaterialText,
  validateCreateMaterialInput,
  type CreateMaterialInput,
  type MaterialDirectoryItem,
  type MaterialOperationResult,
  type UpdateMaterialInput,
} from '../lib/materials'
import { mobilePath } from './mobileRoute'

type MobileMaterialsSection = 'mine' | 'stock' | 'technicians' | 'directory'

const MANAGEMENT_MATERIAL_ROLES = new Set<api.Role>([
  'ADMIN',
  'ADMIN_PROVIDER',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
])

function canUseMaterialsManagement(role?: api.Role | null) {
  return !!role && MANAGEMENT_MATERIAL_ROLES.has(role)
}

function displayUserName(user: api.UserListItem) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function materialById(materials: MaterialDirectoryItem[], materialId: string) {
  return materials.find((item) => item.id === materialId) || null
}

function operationResultText(
  materials: MaterialDirectoryItem[],
  input: { materialId: string; quantity: string },
  result: MaterialOperationResult | null,
) {
  const material = materialById(materials, input.materialId)
  const name = result?.materialName || material?.name || 'Материал'
  const unit = result?.unit || material?.unit || ''
  return {
    name,
    quantity: formatMaterialQuantity(input.quantity, unit),
    stockBalance: result?.updatedStockBalance != null
      ? formatMaterialQuantity(result.updatedStockBalance, unit)
      : '',
  }
}

function MobileMaterialCreateForm(props: {
  submitting?: boolean
  onSubmit: (input: CreateMaterialInput) => void
}) {
  const { submitting = false, onSubmit } = props
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: CreateMaterialInput = {
      name: normalizeMaterialText(name),
      unit: normalizeMaterialText(unit),
      sku: normalizeMaterialText(sku) || null,
      category: normalizeMaterialText(category) || null,
      active,
    }
    const validation = validateCreateMaterialInput(input)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    onSubmit(input)
  }

  return (
    <form className="mobileForm" onSubmit={submit}>
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      <label className="mobileFormField">
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Кабель ВВГ 3×2.5" disabled={submitting} />
      </label>
      <label className="mobileFormField">
        Единица измерения
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="м, шт, кг" disabled={submitting} />
      </label>
      <label className="mobileFormField">
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <label className="mobileFormField">
        Категория
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <label className="mobileFormField" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
        <span>Материал активен</span>
      </label>
      <button type="submit" className="mobileBtn" disabled={submitting}>
        {submitting ? 'Создаём…' : 'Создать материал'}
      </button>
    </form>
  )
}

function MobileMaterialEditForm(props: {
  material: MaterialDirectoryItem
  submitting?: boolean
  onCancel: () => void
  onSubmit: (input: UpdateMaterialInput) => void
}) {
  const { material, submitting = false, onCancel, onSubmit } = props
  const [name, setName] = useState(material.name)
  const [unit, setUnit] = useState(material.unit)
  const [sku, setSku] = useState(material.sku || '')
  const [category, setCategory] = useState(material.category || '')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: UpdateMaterialInput = {
      name: normalizeMaterialText(name),
      unit: normalizeMaterialText(unit),
      sku: normalizeMaterialText(sku) || null,
      category: normalizeMaterialText(category) || null,
    }
    const validation = validateCreateMaterialInput({
      name: input.name || '',
      unit: input.unit || '',
      sku: input.sku,
      category: input.category,
    })
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    onSubmit(input)
  }

  return (
    <form className="mobileForm" onSubmit={submit} style={{ marginTop: 10 }}>
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      <label className="mobileFormField">
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
      </label>
      <label className="mobileFormField">
        Единица измерения
        <input value={unit} onChange={(e) => setUnit(e.target.value)} disabled={submitting} />
      </label>
      <label className="mobileFormField">
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <label className="mobileFormField">
        Категория
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <div className="mobileMaterialsActionRow">
        <button type="submit" className="mobileBtn" disabled={submitting}>Сохранить</button>
        <button type="button" className="mobileBtn mobileBtnSecondary" disabled={submitting} onClick={onCancel}>Отмена</button>
      </div>
    </form>
  )
}

export function MobileMaterialsPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const [section, setSection] = useState<MobileMaterialsSection>('mine')
  const [materialSearch, setMaterialSearch] = useState('')
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [editingMaterialId, setEditingMaterialId] = useState('')
  const [purchaseResult, setPurchaseResult] = useState<{ name: string; quantity: string } | null>(null)
  const [stockResult, setStockResult] = useState<{ name: string; quantity: string; stockBalance: string } | null>(null)
  const [issueResult, setIssueResult] = useState<{ name: string; quantity: string; stockBalance: string } | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const role = meQ.data?.role
  const canManage = canUseMaterialsManagement(role)

  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials })
  const balancesQ = useQuery({ queryKey: ['mobile-my-material-balances'], queryFn: api.myMaterialBalances })
  const historyQ = useQuery({ queryKey: ['mobile-my-material-history'], queryFn: api.myMaterialHistory })
  const usersQ = useQuery({
    queryKey: ['materials-technician-users'],
    queryFn: () => api.users(undefined, { includeDeleted: false }),
    enabled: canManage,
  })
  const technicianBalancesQ = useQuery({
    queryKey: ['mobile-technician-material-balances', selectedTechnicianId],
    queryFn: () => api.technicianMaterialBalances(selectedTechnicianId),
    enabled: canManage && !!selectedTechnicianId,
  })
  const technicianHistoryQ = useQuery({
    queryKey: ['mobile-technician-material-history', selectedTechnicianId],
    queryFn: () => api.technicianMaterialHistory(selectedTechnicianId),
    enabled: canManage && !!selectedTechnicianId,
  })

  const technicianUsers = useMemo(
    () =>
      (usersQ.data || [])
        .filter((user) => user.role === 'TECHNICIAN' && user.isActive !== false && !user.deletedAt)
        .sort((a, b) => displayUserName(a).localeCompare(displayUserName(b), 'ru')),
    [usersQ.data],
  )
  const selectedTechnician = technicianUsers.find((user) => user.id === selectedTechnicianId) || null
  const materialRows = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    const rows = [...(materialsQ.data || [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    if (!q) return rows
    return rows.filter((item) =>
      [item.name, item.unit, item.sku || '', item.category || ''].join(' ').toLowerCase().includes(q),
    )
  }, [materialSearch, materialsQ.data])

  const purchaseM = useMutation({
    mutationFn: api.recordMaterialSelfPurchase,
    onSuccess: async (result, input) => {
      const view = operationResultText(materialsQ.data || [], input, result)
      setPurchaseResult({ name: view.name, quantity: view.quantity })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mobile-my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-history'] }),
      ])
    },
  })
  const createMaterialM = useMutation({
    mutationFn: api.createMaterial,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })
  const updateMaterialM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaterialInput }) => api.updateMaterial(id, input),
    onSuccess: async () => {
      setEditingMaterialId('')
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })
  const stockReceiptM = useMutation({
    mutationFn: api.recordMaterialStockReceipt,
    onSuccess: async (result, input) => {
      setStockResult(operationResultText(materialsQ.data || [], input, result))
    },
  })
  const issueM = useMutation({
    mutationFn: (input: api.ManagerIssueMaterialInput) => api.issueTechnicianMaterial(selectedTechnicianId, input),
    onSuccess: async (result, input) => {
      setIssueResult(operationResultText(materialsQ.data || [], input, result))
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mobile-technician-material-balances', selectedTechnicianId] }),
        qc.invalidateQueries({ queryKey: ['mobile-technician-material-history', selectedTechnicianId] }),
      ])
    },
  })

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Настройки
        </Link>
      </div>

      <h1 className="mobileTitle">Материалы</h1>
      <div className="mobileSubtitle">
        {canManage ? 'Остатки, выдача, склад и справочник' : 'Мои остатки, покупки и история'}
      </div>

      <div className="mobileCard mobileMaterialsHome">
        <button
          type="button"
          className={`mobileBtn${section === 'mine' ? '' : ' mobileBtnSecondary'}`}
          onClick={() => setSection('mine')}
        >
          Мои материалы
        </button>
        {canManage ? (
          <>
            <button
              type="button"
              className={`mobileBtn${section === 'stock' ? '' : ' mobileBtnSecondary'}`}
              onClick={() => setSection('stock')}
            >
              Склад
            </button>
            <button
              type="button"
              className={`mobileBtn${section === 'technicians' ? '' : ' mobileBtnSecondary'}`}
              onClick={() => setSection('technicians')}
            >
              Техники
            </button>
            <button
              type="button"
              className={`mobileBtn${section === 'directory' ? '' : ' mobileBtnSecondary'}`}
              onClick={() => setSection('directory')}
            >
              Справочник
            </button>
          </>
        ) : null}
      </div>

      {section === 'mine' ? (
        <>
          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Текущий остаток</div>
            {balancesQ.isLoading ? <div className="mobileMeta">Загружаем остатки…</div> : null}
            {balancesQ.isError ? (
              <div className="mobileNotice mobileNoticeError">
                {(balancesQ.error as { message?: string } | null)?.message || String(balancesQ.error)}
              </div>
            ) : null}
            {!balancesQ.isLoading && !balancesQ.isError ? (
              <MaterialsBalanceList balances={balancesQ.data || []} />
            ) : null}
          </div>

          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>+ Купил материал</div>
            {purchaseM.isError ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>
                {(purchaseM.error as { message?: string } | null)?.message || String(purchaseM.error)}
              </div>
            ) : null}
            {purchaseResult ? (
              <div className="mobileCardInlineSuccess" style={{ marginBottom: 10 }}>
                Покупка сохранена<br />
                {purchaseResult.name}<br />
                +{purchaseResult.quantity}
              </div>
            ) : null}
            <SelfPurchaseForm
              materials={materialsQ.data || []}
              submitting={purchaseM.isPending}
              onSubmit={(input) => purchaseM.mutate(input)}
            />
          </div>

          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>История</div>
            {historyQ.isLoading ? <div className="mobileMeta">Загружаем историю…</div> : null}
            {historyQ.isError ? (
              <div className="mobileNotice mobileNoticeError">
                {(historyQ.error as { message?: string } | null)?.message || String(historyQ.error)}
              </div>
            ) : null}
            {!historyQ.isLoading && !historyQ.isError ? (
              <MaterialMovementsList movements={historyQ.data || []} />
            ) : null}
          </div>
        </>
      ) : null}

      {section === 'stock' && canManage ? (
        <div className="mobileCard">
          <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Поступление на склад</div>
          <p className="mobileHint" style={{ marginTop: 0 }}>
            V0 проводит приход. Общий складской остаток не перечитывается отдельным endpoint-ом.
          </p>
          {stockReceiptM.isError ? (
            <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>
              {(stockReceiptM.error as { message?: string } | null)?.message || String(stockReceiptM.error)}
            </div>
          ) : null}
          {stockResult ? (
            <div className="mobileCardInlineSuccess" style={{ marginBottom: 10 }}>
              Поступление проведено<br />
              {stockResult.name}<br />
              +{stockResult.quantity}
              {stockResult.stockBalance ? <><br />Остаток: {stockResult.stockBalance}</> : null}
            </div>
          ) : null}
          <StockReceiptForm
            materials={materialsQ.data || []}
            submitting={stockReceiptM.isPending}
            onSubmit={(input) => stockReceiptM.mutate(input)}
          />
        </div>
      ) : null}

      {section === 'technicians' && canManage ? (
        <>
          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Техники</div>
            {usersQ.isLoading ? <div className="mobileMeta">Загружаем техников…</div> : null}
            {usersQ.isError ? (
              <div className="mobileNotice mobileNoticeError">
                {(usersQ.error as { message?: string } | null)?.message || String(usersQ.error)}
              </div>
            ) : null}
            <div className="mobileMaterialsTechnicianList">
              {technicianUsers.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className={`mobileMaterialsTechnicianBtn${selectedTechnicianId === user.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedTechnicianId(user.id)}
                >
                  <span>{displayUserName(user)}</span>
                  <span className="mobileMeta">{user.email}</span>
                </button>
              ))}
            </div>
            {!usersQ.isLoading && technicianUsers.length === 0 ? (
              <div className="mobileEmptyState" role="status">
                <div className="mobileEmptyStateTitle">Техники не найдены</div>
              </div>
            ) : null}
          </div>

          {selectedTechnician ? (
            <div className="mobileCard" style={{ marginTop: 8 }}>
              <div className="mobileSectionTitle" style={{ marginBottom: 4 }}>{displayUserName(selectedTechnician)}</div>
              <div className="mobileMeta" style={{ marginBottom: 12 }}>Материалы техника</div>
              {technicianBalancesQ.isError ? (
                <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>
                  {(technicianBalancesQ.error as { message?: string } | null)?.message || String(technicianBalancesQ.error)}
                </div>
              ) : null}
              <MaterialsBalanceList balances={technicianBalancesQ.data || []} />

              <div className="mobileSectionTitle" style={{ marginTop: 16, marginBottom: 10 }}>+ Выдать материал</div>
              {issueM.isError ? (
                <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>
                  {(issueM.error as { message?: string } | null)?.message || String(issueM.error)}
                </div>
              ) : null}
              {issueResult ? (
                <div className="mobileCardInlineSuccess" style={{ marginBottom: 10 }}>
                  Материал выдан<br />
                  {issueResult.name}<br />
                  +{issueResult.quantity}
                  {issueResult.stockBalance ? <><br />Остаток склада: {issueResult.stockBalance}</> : null}
                </div>
              ) : null}
              <ManagerIssueMaterialForm
                materials={activeMaterials(materialsQ.data || [])}
                submitting={issueM.isPending}
                onSubmit={(input) => issueM.mutate(input)}
              />

              <div className="mobileSectionTitle" style={{ marginTop: 16, marginBottom: 10 }}>История</div>
              {technicianHistoryQ.isError ? (
                <div className="mobileNotice mobileNoticeError">
                  {(technicianHistoryQ.error as { message?: string } | null)?.message || String(technicianHistoryQ.error)}
                </div>
              ) : null}
              <MaterialMovementsList movements={technicianHistoryQ.data || []} />
            </div>
          ) : null}
        </>
      ) : null}

      {section === 'directory' && canManage ? (
        <>
          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Создать материал</div>
            {createMaterialM.isError ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>
                {(createMaterialM.error as { message?: string } | null)?.message || String(createMaterialM.error)}
              </div>
            ) : null}
            <MobileMaterialCreateForm
              submitting={createMaterialM.isPending}
              onSubmit={(input) => createMaterialM.mutate(input)}
            />
          </div>

          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Справочник</div>
            <input
              type="search"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              placeholder="Найти материал"
              style={{ width: '100%', marginBottom: 10 }}
            />
            {materialsQ.isLoading ? <div className="mobileMeta">Загружаем материалы…</div> : null}
            {materialsQ.isError ? (
              <div className="mobileNotice mobileNoticeError">
                {(materialsQ.error as { message?: string } | null)?.message || String(materialsQ.error)}
              </div>
            ) : null}
            <div className="mobileMaterialsDirectory">
              {materialRows.map((item) => (
                <div key={item.id} className="mobileMaterialsDirectoryCard">
                  <div className="mobileMaterialsDirectoryTitle">{item.name}</div>
                  <div className="mobileMeta">
                    {item.unit}
                    {item.sku ? ` · SKU ${item.sku}` : ''}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.active === false ? ' · неактивен' : ''}
                  </div>
                  <div className="mobileMaterialsActionRow">
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary"
                      onClick={() => setEditingMaterialId(editingMaterialId === item.id ? '' : item.id)}
                      disabled={updateMaterialM.isPending}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary"
                      disabled={updateMaterialM.isPending}
                      onClick={() => updateMaterialM.mutate({ id: item.id, input: { active: item.active === false } })}
                    >
                      {item.active === false ? 'Активировать' : 'Деактивировать'}
                    </button>
                  </div>
                  {editingMaterialId === item.id ? (
                    <MobileMaterialEditForm
                      material={item}
                      submitting={updateMaterialM.isPending}
                      onCancel={() => setEditingMaterialId('')}
                      onSubmit={(input) => updateMaterialM.mutate({ id: item.id, input })}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
