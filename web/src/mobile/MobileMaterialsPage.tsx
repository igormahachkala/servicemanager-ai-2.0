import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'
import {
  EMPTY_MATERIAL_PURCHASE_DRAFT,
  formatQuantity,
  movementDirection,
  movementLabel,
  movementSignedQuantity,
  purchasableCatalog,
  validateMaterialPurchase,
  visibleBalances,
  type MaterialPurchaseDraft,
} from '../lib/ticketMaterials'

/**
 * SMA-MATERIALS-V0 — «Мои материалы» на телефоне.
 *
 * Рабочее место техника: что у него на руках, что с этим происходило
 * и как записать покупку, сделанную за свой счёт.
 *
 * Здесь нет склада, выдачи, чужих остатков и администрирования справочника:
 * это ежедневный цикл техника, а управленческая часть принадлежит другому
 * срезу. Канонический остаток считает сервер — локального журнала нет.
 */

export function MobileMaterialsPage() {
  const location = useLocation()
  const qc = useQueryClient()

  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [draft, setDraft] = useState<MaterialPurchaseDraft>(EMPTY_MATERIAL_PURCHASE_DRAFT)
  const [submitError, setSubmitError] = useState('')

  const balancesQ = useQuery({
    queryKey: ['my-material-balances'],
    queryFn: () => api.myMaterialBalances(),
  })

  const movementsQ = useQuery({
    queryKey: ['my-material-movements'],
    queryFn: () => api.myMaterialMovements(),
  })

  /* Справочник нужен только для покупки: без открытой формы его не тянем. */
  const catalogQ = useQuery({
    queryKey: ['materials-catalog'],
    queryFn: () => api.materialsCatalog(),
    enabled: purchaseOpen,
  })

  const balances = useMemo(() => visibleBalances(balancesQ.data), [balancesQ.data])
  const movements = movementsQ.data ?? null
  const catalog = useMemo(() => purchasableCatalog(catalogQ.data), [catalogQ.data])
  const validation = useMemo(() => validateMaterialPurchase(draft, catalog), [draft, catalog])

  const purchaseM = useMutation({
    mutationFn: async () => {
      if (!validation.ok) throw new Error(validation.message)
      return api.recordMaterialPurchase(validation.payload)
    },
    onSuccess: async () => {
      setDraft(EMPTY_MATERIAL_PURCHASE_DRAFT)
      setSubmitError('')
      setPurchaseOpen(false)
      // Остаток и журнал пересчитывает сервер, поэтому обе выборки перечитываются.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['my-material-movements'] }),
      ])
    },
    onError: (err: unknown) => {
      // Отказ не закрывает форму и не добавляет остаток.
      setSubmitError((err as any)?.message || 'Не удалось записать покупку')
    },
  })

  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/settings')} className="mobileDetailsBackLink">
          Настройки
        </Link>
      </div>

      <div className="mobileSection">
        <h1 className="mobileTitle">Мои материалы</h1>
        <div className="mobileSubtitle">То, что у вас на руках</div>

        <div className="mobileCard" style={{ marginTop: 12 }}>
          <div className="row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
            <h2 className="mobileSectionTitle" style={{ marginBottom: 0 }}>
              Остатки
            </h2>
            {!purchaseOpen ? (
              <button type="button" className="mobileBtn mobileBtnGhost" onClick={() => setPurchaseOpen(true)}>
                + Купил материал
              </button>
            ) : null}
          </div>

          {balancesQ.isLoading ? (
            <div className="mobileMeta">Загружаем остатки…</div>
          ) : balancesQ.isError ? (
            <div className="mobileNotice mobileNoticeError">
              {(balancesQ.error as any)?.message || 'Не удалось загрузить остатки'}
            </div>
          ) : balances.length === 0 ? (
            <div className="mobileMeta">На руках нет материалов</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {balances.map((item) => (
                <div key={item.materialId}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="mobileMeta">
                    {formatQuantity(item.available)} {item.unit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {purchaseOpen ? (
            <form
              style={{ marginTop: 12, display: 'grid', gap: 8 }}
              onSubmit={(event) => {
                event.preventDefault()
                setSubmitError('')
                if (!validation.ok) {
                  setSubmitError(validation.message)
                  return
                }
                purchaseM.mutate()
              }}
            >
              <label className="mobileMeta" htmlFor="purchaseMaterialId">
                Материал
              </label>
              <select
                id="purchaseMaterialId"
                className="mobileInput"
                value={draft.materialId}
                onChange={(event) => setDraft((prev) => ({ ...prev, materialId: event.target.value }))}
              >
                <option value="">Выберите материал</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>

              {catalogQ.isLoading ? <div className="mobileMeta">Загружаем справочник…</div> : null}
              {catalogQ.isError ? (
                <div className="mobileNotice mobileNoticeError">
                  {(catalogQ.error as any)?.message || 'Не удалось загрузить справочник'}
                </div>
              ) : null}

              <label className="mobileMeta" htmlFor="purchaseQuantity">
                Количество
              </label>
              <input
                id="purchaseQuantity"
                className="mobileInput"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={draft.quantity}
                onChange={(event) => setDraft((prev) => ({ ...prev, quantity: event.target.value }))}
              />

              <label className="mobileMeta" htmlFor="purchaseUnitPrice">
                Цена за единицу
              </label>
              <input
                id="purchaseUnitPrice"
                className="mobileInput"
                inputMode="decimal"
                value={draft.unitPrice}
                onChange={(event) => setDraft((prev) => ({ ...prev, unitPrice: event.target.value }))}
              />

              <label className="mobileMeta" htmlFor="purchaseTotalPrice">
                Сумма
              </label>
              <input
                id="purchaseTotalPrice"
                className="mobileInput"
                inputMode="decimal"
                value={draft.totalPrice}
                onChange={(event) => setDraft((prev) => ({ ...prev, totalPrice: event.target.value }))}
              />

              <label className="mobileMeta" htmlFor="purchaseComment">
                Комментарий
              </label>
              <input
                id="purchaseComment"
                className="mobileInput"
                value={draft.comment}
                onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
              />

              {!validation.ok && draft.materialId && draft.quantity ? (
                <div className="mobileMeta">{validation.message}</div>
              ) : null}
              {submitError ? <div className="mobileNotice mobileNoticeError">{submitError}</div> : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  className="mobileBtn"
                  disabled={!validation.ok || purchaseM.isPending}
                >
                  {purchaseM.isPending ? 'Записываем…' : 'Записать покупку'}
                </button>
                <button
                  type="button"
                  className="mobileBtn mobileBtnGhost"
                  onClick={() => {
                    setPurchaseOpen(false)
                    setDraft(EMPTY_MATERIAL_PURCHASE_DRAFT)
                    setSubmitError('')
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="mobileCard" style={{ marginTop: 12 }}>
          <h2 className="mobileSectionTitle">История</h2>

          {movementsQ.isLoading ? (
            <div className="mobileMeta">Загружаем историю…</div>
          ) : movementsQ.isError ? (
            <div className="mobileNotice mobileNoticeError">
              {(movementsQ.error as any)?.message || 'Не удалось загрузить историю'}
            </div>
          ) : !movements || movements.length === 0 ? (
            <div className="mobileMeta">Движений пока нет</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {movements.map((movement) => (
                <div key={movement.id}>
                  <div style={{ fontWeight: 600 }}>{movement.name}</div>
                  <div className="mobileMeta">{movementLabel(movement)}</div>
                  {/* Направление различает виды и глазами, не только знаком. */}
                  <div
                    className={
                      movementDirection(movement) === 'out'
                        ? 'mobileMaterialsOut'
                        : 'mobileMaterialsIn'
                    }
                  >
                    {movementSignedQuantity(movement)}
                  </div>
                  <div className="mobileMeta">
                    {api.formatNotificationDateTime(movement.occurredAt || movement.createdAt || '')}
                  </div>
                  {movement.comment ? <div className="mobileMeta">{movement.comment}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
