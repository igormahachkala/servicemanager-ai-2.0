import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { compactIdentityLabel, presentActorIdentity } from '../lib/ticketActorIdentity'
import {
  EMPTY_MATERIAL_USAGE_DRAFT,
  canConsumeMaterials,
  formatQuantity,
  maxQuantityFor,
  selectableBalances,
  validateMaterialUsage,
  type MaterialConsumption,
  type MaterialUsageDraft,
} from '../lib/ticketMaterials'

/**
 * SMA-MATERIALS-V0 — материалы внутри мобильной заявки.
 *
 * Техник работает через /m, поэтому списание живёт здесь, а не только
 * в настольной карточке. Область заявки берётся из существующего
 * мобильного контекста и передаётся сверху: своего резолвера области
 * этот блок не заводит.
 *
 * Остаток считает сервер. Локального учёта здесь нет: после списания обе
 * выборки перезапрашиваются, и при отказе ничего не вычитается.
 */

type Props = {
  ticketId: string
  role: api.Role | undefined
  /** Контур заявки из мобильного контекста; уходит в тело списания как есть. */
  scope?: api.TicketScopeParams
}

function actorLabel(row: MaterialConsumption): string {
  return compactIdentityLabel(presentActorIdentity(row.usedBy ?? row.actor ?? null))
}

function consumedAt(row: MaterialConsumption): string {
  return api.formatNotificationDateTime(row.consumedAt || row.createdAt || '')
}

export function MobileTicketMaterials({ ticketId, role, scope }: Props) {
  const qc = useQueryClient()
  const canConsume = canConsumeMaterials(role)

  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<MaterialUsageDraft>(EMPTY_MATERIAL_USAGE_DRAFT)
  const [submitError, setSubmitError] = useState('')

  const consumptionsQ = useQuery({
    queryKey: ['ticket-material-consumptions', ticketId, scope?.companyId, scope?.linkedClientCompanyId],
    queryFn: () => api.ticketMaterialConsumptions(ticketId, scope),
    enabled: !!ticketId,
  })

  /* Остатки нужны только тому, кто списывает. */
  const balancesQ = useQuery({
    queryKey: ['my-material-balances', scope?.companyId, scope?.linkedClientCompanyId],
    queryFn: () => api.myMaterialBalances(scope),
    enabled: canConsume && formOpen,
  })

  const balances = useMemo(() => selectableBalances(balancesQ.data), [balancesQ.data])
  const validation = useMemo(() => validateMaterialUsage(draft, balances), [draft, balances])
  const selected = balances.find((item) => item.materialId === draft.materialId)

  const consumeM = useMutation({
    mutationFn: async () => {
      if (!validation.ok) throw new Error(validation.message)
      return api.consumeMaterial({
        ticketId,
        materialId: validation.payload.materialId,
        quantity: validation.payload.quantity,
        ...(validation.payload.comment ? { comment: validation.payload.comment } : {}),
        ...(scope?.linkedClientCompanyId ? { linkedClientCompanyId: scope.linkedClientCompanyId } : {}),
      })
    },
    onSuccess: async () => {
      setDraft(EMPTY_MATERIAL_USAGE_DRAFT)
      setSubmitError('')
      setFormOpen(false)
      /*
       * Перезапрашивается всё, что изменилось: материалы заявки, остатки
       * и журнал движений. Остаток не правится на месте — его считает сервер.
       */
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket-material-consumptions', ticketId] }),
        qc.invalidateQueries({ queryKey: ['my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['my-material-movements'] }),
      ])
    },
    onError: async (err: unknown) => {
      /*
       * Отказ остаётся отказом: форма не закрывается, черновик цел, ничего
       * не вычитается. Остаток при этом перезапрашивается: 409 означает,
       * что остаток изменился на другом устройстве, и показать нужно
       * настоящее текущее состояние, а не то, что помнил экран.
       */
      setSubmitError((err as any)?.message || 'Не удалось списать материал')
      await qc.invalidateQueries({ queryKey: ['my-material-balances'] })
    },
  })

  const rows = consumptionsQ.data ?? null

  return (
    <div className="mobileCard" style={{ marginTop: 12 }}>
      <div className="row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
        <h2 className="mobileSectionTitle" style={{ marginBottom: 0 }}>
          Материалы
        </h2>
        {canConsume && !formOpen ? (
          <button type="button" className="mobileBtn mobileBtnGhost" onClick={() => setFormOpen(true)}>
            + Добавить материал
          </button>
        ) : null}
      </div>

      {consumptionsQ.isLoading ? (
        <div className="mobileMeta">Загружаем материалы…</div>
      ) : consumptionsQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          {(consumptionsQ.error as any)?.message || 'Не удалось загрузить материалы'}
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="mobileMeta">Материалы не списывались</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id}>
              <div style={{ fontWeight: 600 }}>
                {row.name} — {formatQuantity(row.quantity)} {row.unit}
              </div>
              <div className="mobileMeta">{actorLabel(row)}</div>
              <div className="mobileMeta">{consumedAt(row)}</div>
              {row.comment ? <div className="mobileMeta">{row.comment}</div> : null}
            </div>
          ))}
        </div>
      )}

      {canConsume && formOpen ? (
        <form
          style={{ marginTop: 12, display: 'grid', gap: 8 }}
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitError('')
            if (!validation.ok) {
              setSubmitError(validation.message)
              return
            }
            consumeM.mutate()
          }}
        >
          <label className="mobileMeta" htmlFor="mobileMaterialId">
            Материал
          </label>
          <select
            id="mobileMaterialId"
            className="mobileInput"
            value={draft.materialId}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, materialId: event.target.value, quantity: '' }))
            }
          >
            <option value="">Выберите материал</option>
            {balances.map((item) => (
              <option key={item.materialId} value={item.materialId}>
                {item.name} — доступно {formatQuantity(item.available)} {item.unit}
              </option>
            ))}
          </select>

          {balancesQ.isLoading ? <div className="mobileMeta">Загружаем остатки…</div> : null}
          {balancesQ.isError ? (
            <div className="mobileNotice mobileNoticeError">
              {(balancesQ.error as any)?.message || 'Не удалось загрузить остатки'}
            </div>
          ) : null}
          {!balancesQ.isLoading && !balancesQ.isError && balances.length === 0 ? (
            <div className="mobileMeta">На руках нет материалов</div>
          ) : null}

          {selected ? (
            /* Остаток только показывается: изменить его можно лишь списанием. */
            <div className="mobileMeta">
              Доступно: {formatQuantity(selected.available)} {selected.unit}
            </div>
          ) : null}

          <label className="mobileMeta" htmlFor="mobileMaterialQuantity">
            Количество
          </label>
          <input
            id="mobileMaterialQuantity"
            className="mobileInput"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            max={maxQuantityFor(draft.materialId, balances)}
            value={draft.quantity}
            onChange={(event) => setDraft((prev) => ({ ...prev, quantity: event.target.value }))}
          />

          <label className="mobileMeta" htmlFor="mobileMaterialComment">
            Комментарий
          </label>
          <input
            id="mobileMaterialComment"
            className="mobileInput"
            value={draft.comment}
            onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
          />

          {!validation.ok && draft.materialId && draft.quantity ? (
            <div className="mobileMeta">{validation.message}</div>
          ) : null}
          {submitError ? <div className="mobileNotice mobileNoticeError">{submitError}</div> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="mobileBtn" disabled={!validation.ok || consumeM.isPending}>
              {consumeM.isPending ? 'Списываем…' : 'Списать'}
            </button>
            <button
              type="button"
              className="mobileBtn mobileBtnGhost"
              onClick={() => {
                setFormOpen(false)
                setDraft(EMPTY_MATERIAL_USAGE_DRAFT)
                setSubmitError('')
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
