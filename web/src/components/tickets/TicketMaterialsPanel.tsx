import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { compactIdentityLabel, presentActorIdentity } from '../../lib/ticketActorIdentity'
import {
  EMPTY_MATERIAL_USAGE_DRAFT,
  canConsumeMaterials,
  formatQuantity,
  maxQuantityFor,
  selectableBalances,
  validateMaterialUsage,
  type MaterialUsageDraft,
} from '../../lib/ticketMaterials'

/**
 * SMA-MATERIALS-V0-TICKET-USAGE.
 *
 * Блок «Материалы» в карточке заявки: что списано на эту заявку и, для
 * техника, форма списания из того, что у него на руках.
 *
 * Остаток приходит с сервера и правится только списанием — поля для ручной
 * правки здесь нет намеренно. Решения о допустимости вынесены в
 * lib/ticketMaterials: окружение тестов node, и правила должны проверяться
 * исполнением, а не через разметку.
 */

type Props = {
  ticketId: string
  role: api.Role | undefined
  scope?: api.TicketScopeParams
}

export function TicketMaterialsPanel({ ticketId, role, scope }: Props) {
  const qc = useQueryClient()
  const canConsume = canConsumeMaterials(role)

  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<MaterialUsageDraft>(EMPTY_MATERIAL_USAGE_DRAFT)
  const [submitError, setSubmitError] = useState('')

  const usageQ = useQuery({
    queryKey: ['ticket-material-consumptions', ticketId, scope?.companyId, scope?.linkedClientCompanyId],
    queryFn: () => api.ticketMaterialConsumptions(ticketId, scope),
    enabled: !!ticketId,
  })

  /* Остатки нужны только тому, кто списывает: лишнего запроса у остальных ролей нет. */
  const balancesQ = useQuery({
    queryKey: ['my-material-balances', scope?.companyId, scope?.linkedClientCompanyId],
    queryFn: () => api.myMaterialBalances(scope),
    enabled: canConsume && formOpen,
  })

  const balances = useMemo(() => selectableBalances(balancesQ.data), [balancesQ.data])
  const validation = useMemo(() => validateMaterialUsage(draft, balances), [draft, balances])
  const selectedBalance = balances.find((item) => item.materialId === draft.materialId)

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
      /*
       * Обновляются обе выборки: список материалов заявки и остатки техника.
       * Остаток пересчитывает сервер, поэтому он именно перезапрашивается,
       * а не правится на месте — иначе интерфейс начал бы вести свой учёт.
       */
      setDraft(EMPTY_MATERIAL_USAGE_DRAFT)
      setSubmitError('')
      setFormOpen(false)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket-material-consumptions', ticketId] }),
        qc.invalidateQueries({ queryKey: ['my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['my-material-movements'] }),
      ])
    },
    onError: (err: unknown) => {
      // Отказ остаётся отказом: форма не закрывается и черновик не теряется.
      setSubmitError((err as any)?.message || 'Не удалось списать материал')
    },
  })

  const usages = usageQ.data ?? null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="row" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
        <h3 style={{ marginBottom: 0 }}>Материалы</h3>
        {canConsume && !formOpen ? (
          <button type="button" className="ghost" onClick={() => setFormOpen(true)}>
            + Добавить материал
          </button>
        ) : null}
      </div>

      {usageQ.isLoading ? (
        <div className="muted small">Загружаем материалы…</div>
      ) : usageQ.isError ? (
        <div className="alert">
          {(usageQ.error as any)?.message || 'Не удалось загрузить материалы'}
        </div>
      ) : !usages || usages.length === 0 ? (
        <div className="muted small">Материалы не списывались</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {usages.map((usage) => {
            const who = compactIdentityLabel(presentActorIdentity(usage.usedBy ?? usage.actor ?? null))
            return (
              <div key={usage.id}>
                <div style={{ fontWeight: 600 }}>
                  {usage.name} — {formatQuantity(usage.quantity)} {usage.unit}
                </div>
                <div className="muted small">{who}</div>
                <div className="muted small">{api.formatNotificationDateTime(usage.consumedAt || usage.createdAt || '')}</div>
                {usage.comment ? <div className="muted small">{usage.comment}</div> : null}
              </div>
            )
          })}
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
          <label className="muted small" htmlFor="materialId">
            Материал
          </label>
          <select
            id="materialId"
            value={draft.materialId}
            onChange={(event) => setDraft((prev) => ({ ...prev, materialId: event.target.value, quantity: '' }))}
          >
            <option value="">Выберите материал</option>
            {balances.map((item) => (
              <option key={item.materialId} value={item.materialId}>
                {item.name} ({formatQuantity(item.available)} {item.unit})
              </option>
            ))}
          </select>

          {balancesQ.isLoading ? <div className="muted small">Загружаем остатки…</div> : null}
          {balancesQ.isError ? (
            <div className="alert">
              {(balancesQ.error as any)?.message || 'Не удалось загрузить остатки'}
            </div>
          ) : null}
          {!balancesQ.isLoading && !balancesQ.isError && balances.length === 0 ? (
            <div className="muted small">На руках нет материалов</div>
          ) : null}

          {selectedBalance ? (
            /* Остаток только показывается: изменить его можно лишь списанием. */
            <div className="muted small">
              Доступно: {formatQuantity(selectedBalance.available)} {selectedBalance.unit}
            </div>
          ) : null}

          <label className="muted small" htmlFor="materialQuantity">
            Количество
          </label>
          <input
            id="materialQuantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            max={maxQuantityFor(draft.materialId, balances)}
            value={draft.quantity}
            onChange={(event) => setDraft((prev) => ({ ...prev, quantity: event.target.value }))}
          />

          <label className="muted small" htmlFor="materialComment">
            Комментарий
          </label>
          <input
            id="materialComment"
            value={draft.comment}
            onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value }))}
          />

          {!validation.ok && draft.materialId && draft.quantity ? (
            <div className="muted small">{validation.message}</div>
          ) : null}
          {submitError ? <div className="alert">{submitError}</div> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={!validation.ok || consumeM.isPending}>
              {consumeM.isPending ? 'Списываем…' : 'Списать'}
            </button>
            <button
              type="button"
              className="ghost"
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
