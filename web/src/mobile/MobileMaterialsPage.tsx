import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { MaterialMovementsList, MaterialsBalanceList, SelfPurchaseForm } from '../components/materials/MaterialsPanels'
import { canUseManagementMaterials, getMobileMaterialsEntry } from './mobileMaterialsEntry'
import {
  activeMaterials,
  formatMaterialQuantity,
  normalizeDecimalInput,
  validateIssueInput,
  validateMaterialInput,
  type CreateMaterialInput,
  type Material,
  type UpdateMaterialInput,
} from '../lib/materials'
import { mobilePath } from './mobileRoute'

type Section = 'mine' | 'stock' | 'technicians' | 'directory'
type MaterialDraft = { name: string; unit: string; sku: string; category: string }
const EMPTY_MATERIAL: MaterialDraft = { name: '', unit: '', sku: '', category: '' }

function userName(user: api.UserListItem) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
}

function materialInput(draft: MaterialDraft): CreateMaterialInput {
  return {
    name: draft.name.trim(),
    unit: draft.unit.trim(),
    sku: draft.sku.trim() || null,
    category: draft.category.trim() || null,
  }
}

export function MobileMaterialsPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const [section, setSection] = useState<Section>('mine')
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [editing, setEditing] = useState<(MaterialDraft & { id: string }) | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  /* Тот же предикат, что и у входа: разделы и пункт меню не расходятся. */
  const canManage = canUseManagementMaterials(meQ.data)

  /*
   * Заголовок совпадает с подписью входа, а возврат ведёт в корень
   * мобильного шелла: страница открывается с главного экрана, из «Ещё» и
   * из настроек, и жёсткий возврат в настройки был верен лишь для одного.
   */
  const pageTitle = getMobileMaterialsEntry(meQ.data, location.pathname)?.label ?? 'Материалы'
  const backHref = useMemo(() => mobilePath(location.pathname, ''), [location.pathname])

  useEffect(() => {
    if (meQ.isSuccess && !isTechnician && canManage && section === 'mine') setSection('stock')
  }, [canManage, isTechnician, meQ.isSuccess, section])

  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials })
  const balancesQ = useQuery({
    queryKey: ['mobile-my-material-balances'],
    queryFn: api.myMaterialBalances,
    enabled: isTechnician,
  })
  const historyQ = useQuery({
    queryKey: ['mobile-my-material-history'],
    queryFn: api.myMaterialMovements,
    enabled: isTechnician,
  })
  const usersQ = useQuery({
    queryKey: ['materials-technician-users'],
    queryFn: () => api.users(undefined, { includeDeleted: false }),
    enabled: canManage && section === 'technicians',
  })
  const technicians = useMemo(
    () => (usersQ.data || [])
      .filter((user) => user.role === 'TECHNICIAN' && user.isActive !== false && !user.deletedAt)
      .sort((a, b) => userName(a).localeCompare(userName(b), 'ru')),
    [usersQ.data],
  )
  const selectedTechnician = technicians.find((user) => user.id === selectedTechnicianId)
  const technicianBalancesQ = useQuery({
    queryKey: ['mobile-technician-material-balances', selectedTechnicianId],
    queryFn: () => api.technicianMaterialBalances(selectedTechnicianId),
    enabled: canManage && !!selectedTechnicianId,
  })
  const technicianMovementsQ = useQuery({
    queryKey: ['mobile-technician-material-movements', selectedTechnicianId],
    queryFn: () => api.technicianMaterialMovements(selectedTechnicianId),
    enabled: canManage && !!selectedTechnicianId,
  })

  const purchaseM = useMutation({
    mutationFn: api.recordMaterialSelfPurchase,
    onSuccess: async (result) => {
      setNotice(`Покупка сохранена. Остаток: ${formatMaterialQuantity(result.balance.quantity, result.balance.material?.unit)}`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mobile-my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-history'] }),
      ])
    },
  })
  const createM = useMutation({
    mutationFn: api.createMaterial,
    onSuccess: async () => {
      setNotice('Материал создан')
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })
  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaterialInput }) => api.updateMaterial(id, input),
    onSuccess: async () => {
      setEditing(null)
      setNotice('Материал обновлён')
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })
  const receiptM = useMutation({
    mutationFn: api.recordCompanyStockReceipt,
    onSuccess: (result) => {
      setNotice(`Поступление сохранено. Остаток склада: ${formatMaterialQuantity(result.balance.quantity, result.balance.material?.unit)}`)
    },
  })
  const issueM = useMutation({
    mutationFn: api.issueMaterialToTechnician,
    onSuccess: async (result) => {
      setNotice(
        `Материал выдан. У техника: ${formatMaterialQuantity(result.technicianBalance.quantity, result.technicianBalance.material?.unit)}; склад: ${formatMaterialQuantity(result.stock.quantity, result.stock.material?.unit)}`,
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mobile-technician-material-balances', selectedTechnicianId] }),
        qc.invalidateQueries({ queryKey: ['mobile-technician-material-movements', selectedTechnicianId] }),
      ])
    },
  })

  const error =
    materialsQ.error || purchaseM.error || createM.error || updateM.error || receiptM.error || issueM.error

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        {/*
          Материалы открываются с главного экрана, из «Ещё» и из настроек.
          Жёсткий возврат в настройки был верен только для одного из трёх
          входов. Берётся соглашение страниц с несколькими входами
          (уведомления, «Ещё», профиль): возврат в корень мобильного шелла.
        */}
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          Назад
        </Link>
      </div>
      {/* Заголовок совпадает с подписью входа: техник открывает «Мои материалы». */}
      <h1 className="mobileTitle">{pageTitle}</h1>
      <div className="mobileSubtitle">
        {canManage ? 'Склад, техники и справочник' : 'Мои остатки, покупки и история'}
      </div>

      {error ? <div className="mobileNotice mobileNoticeError">{(error as Error).message}</div> : null}
      {notice ? <div className="mobileCardInlineSuccess">{notice}</div> : null}

      <div className="mobileCard mobileMaterialsHome">
        {isTechnician ? <SectionButton active={section === 'mine'} onClick={() => setSection('mine')}>Мои материалы</SectionButton> : null}
        {canManage ? (
          <>
            <SectionButton active={section === 'stock'} onClick={() => setSection('stock')}>Склад</SectionButton>
            <SectionButton active={section === 'technicians'} onClick={() => setSection('technicians')}>Техники</SectionButton>
            <SectionButton active={section === 'directory'} onClick={() => setSection('directory')}>Справочник</SectionButton>
          </>
        ) : null}
      </div>

      {section === 'mine' && isTechnician ? (
        <>
          <div className="mobileCard">
            <h2 className="mobileSectionTitle">Текущий остаток</h2>
            {balancesQ.isLoading ? <div className="mobileMeta">Загружаем остатки…</div> : null}
            {balancesQ.isError ? <div className="mobileNotice mobileNoticeError">{(balancesQ.error as Error).message}</div> : null}
            {!balancesQ.isLoading && !balancesQ.isError ? <MaterialsBalanceList balances={balancesQ.data || []} /> : null}
          </div>
          <div className="mobileCard" style={{ marginTop: 8 }}>
            <h2 className="mobileSectionTitle">+ Купил материал</h2>
            <SelfPurchaseForm
              materials={materialsQ.data || []}
              submitting={purchaseM.isPending}
              onSubmit={(input) => purchaseM.mutate(input)}
            />
          </div>
          <div className="mobileCard" style={{ marginTop: 8 }}>
            <h2 className="mobileSectionTitle">История</h2>
            {historyQ.isLoading ? <div className="mobileMeta">Загружаем историю…</div> : null}
            {historyQ.isError ? <div className="mobileNotice mobileNoticeError">{(historyQ.error as Error).message}</div> : null}
            {!historyQ.isLoading && !historyQ.isError ? <MaterialMovementsList movements={historyQ.data || []} /> : null}
          </div>
        </>
      ) : null}

      {section === 'stock' && canManage ? (
        <div className="mobileCard">
          <h2 className="mobileSectionTitle">Поступление на склад</h2>
          <p className="mobileHint">V0 показывает новый остаток из ответа операции. Отдельного чтения склада нет.</p>
          <QuantityForm
            materials={materialsQ.data || []}
            submitLabel="Принять на склад"
            pending={receiptM.isPending}
            onSubmit={(input) => receiptM.mutate(input)}
          />
        </div>
      ) : null}

      {section === 'technicians' && canManage ? (
        <>
          <div className="mobileCard">
            <h2 className="mobileSectionTitle">Техники</h2>
            {usersQ.isLoading ? <div className="mobileMeta">Загружаем техников…</div> : null}
            {usersQ.isError ? <div className="mobileNotice mobileNoticeError">{(usersQ.error as Error).message}</div> : null}
            <div style={{ display: 'grid', gap: 8 }}>
              {technicians.map((user) => (
                <button
                  type="button"
                  className={selectedTechnicianId === user.id ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
                  key={user.id}
                  onClick={() => setSelectedTechnicianId(user.id)}
                >
                  {userName(user)}
                </button>
              ))}
            </div>
            {!usersQ.isLoading && !technicians.length ? <div className="mobileMeta">Техники не найдены</div> : null}
          </div>
          {selectedTechnician ? (
            <div className="mobileCard" style={{ marginTop: 8 }}>
              <h2 className="mobileSectionTitle">{userName(selectedTechnician)}</h2>
              {technicianBalancesQ.isLoading ? <div className="mobileMeta">Загружаем остатки…</div> : null}
              {technicianBalancesQ.isError ? <div className="mobileNotice mobileNoticeError">{(technicianBalancesQ.error as Error).message}</div> : null}
              <MaterialsBalanceList balances={technicianBalancesQ.data || []} />
              <h3 className="mobileSectionTitle" style={{ marginTop: 16 }}>+ Выдать материал</h3>
              <QuantityForm
                materials={materialsQ.data || []}
                submitLabel="Выдать"
                pending={issueM.isPending}
                onSubmit={(input) => issueM.mutate({ technicianId: selectedTechnician.id, ...input })}
              />
              <h3 className="mobileSectionTitle" style={{ marginTop: 16 }}>История</h3>
              {technicianMovementsQ.isError ? <div className="mobileNotice mobileNoticeError">{(technicianMovementsQ.error as Error).message}</div> : null}
              <MaterialMovementsList movements={technicianMovementsQ.data || []} />
            </div>
          ) : null}
        </>
      ) : null}

      {section === 'directory' && canManage ? (
        <>
          <div className="mobileCard">
            <h2 className="mobileSectionTitle">Новый материал</h2>
            <MaterialForm pending={createM.isPending} onSubmit={(input) => createM.mutate(input)} />
          </div>
          <div className="mobileCard" style={{ marginTop: 8 }}>
            <h2 className="mobileSectionTitle">Справочник</h2>
            {materialsQ.isLoading ? <div className="mobileMeta">Загружаем справочник…</div> : null}
            {(materialsQ.data || []).map((material) => (
              <div key={material.id} className="materialsHistoryRow">
                <div>
                  <strong>{material.name} · {material.unit}</strong>
                  <div className="mobileMeta">{[material.sku, material.category, material.active ? 'Активен' : 'Неактивен'].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="mobileBtn mobileBtnSecondary" onClick={() => setEditing({
                    id: material.id,
                    name: material.name,
                    unit: material.unit,
                    sku: material.sku || '',
                    category: material.category || '',
                  })}>Изменить</button>
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary"
                    onClick={() => updateM.mutate({ id: material.id, input: { active: !material.active } })}
                  >
                    {material.active ? 'Деактивировать' : 'Активировать'}
                  </button>
                </div>
                {editing?.id === material.id ? (
                  <MaterialForm
                    initial={editing}
                    pending={updateM.isPending}
                    submitLabel="Сохранить"
                    onCancel={() => setEditing(null)}
                    onSubmit={(input) => updateM.mutate({ id: material.id, input })}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function SectionButton(props: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" className={props.active ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'} onClick={props.onClick}>{props.children}</button>
}

function QuantityForm(props: {
  materials: Material[]
  submitLabel: string
  pending: boolean
  onSubmit: (input: { materialId: string; quantity: string; comment?: string }) => void
}) {
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeDecimalInput(quantity) ?? quantity.trim()
    const validation = validateIssueInput({ materialId, quantity: normalized })
    if (!validation.ok) return setError(validation.error)
    setError(null)
    props.onSubmit({ materialId, quantity: normalized, ...(comment.trim() ? { comment: comment.trim() } : {}) })
  }
  return (
    <form className="mobileForm" onSubmit={submit}>
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      <label className="mobileFormField">Материал
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          <option value="">Выберите материал</option>
          {activeMaterials(props.materials).map((material) => <option key={material.id} value={material.id}>{material.name} · {material.unit}</option>)}
        </select>
      </label>
      <label className="mobileFormField">Количество
        <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <label className="mobileFormField">Комментарий
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <button type="submit" className="mobileBtn" disabled={props.pending}>{props.pending ? 'Сохраняем…' : props.submitLabel}</button>
    </form>
  )
}

function MaterialForm(props: {
  initial?: MaterialDraft
  pending: boolean
  submitLabel?: string
  onCancel?: () => void
  onSubmit: (input: CreateMaterialInput) => void
}) {
  const [draft, setDraft] = useState<MaterialDraft>(props.initial || EMPTY_MATERIAL)
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const input = materialInput(draft)
    const validation = validateMaterialInput(input)
    if (!validation.ok) return setError(validation.error)
    setError(null)
    props.onSubmit(input)
  }
  return (
    <form className="mobileForm" onSubmit={submit}>
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      <label className="mobileFormField">Название<input value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} /></label>
      <label className="mobileFormField">Единица измерения<input value={draft.unit} onChange={(e) => setDraft((v) => ({ ...v, unit: e.target.value }))} /></label>
      <label className="mobileFormField">SKU<input value={draft.sku} onChange={(e) => setDraft((v) => ({ ...v, sku: e.target.value }))} /></label>
      <label className="mobileFormField">Категория<input value={draft.category} onChange={(e) => setDraft((v) => ({ ...v, category: e.target.value }))} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="mobileBtn" disabled={props.pending}>{props.pending ? 'Сохраняем…' : props.submitLabel || 'Создать материал'}</button>
        {props.onCancel ? <button type="button" className="mobileBtn mobileBtnSecondary" onClick={props.onCancel}>Отмена</button> : null}
      </div>
    </form>
  )
}
