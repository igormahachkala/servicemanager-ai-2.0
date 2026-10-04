import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { formatMaterialQuantity, materialName, materialUnit, materialUserName } from '../../lib/materials'
import {
  EMPTY_MATERIAL_USAGE_DRAFT,
  canConsumeMaterials,
  maxQuantityFor,
  selectableBalances,
  validateMaterialUsage,
  type MaterialUsageDraft,
} from '../../lib/ticketMaterials'

export function TicketMaterialsPanel(props: {
  ticketId: string
  role?: api.Role | null
  scope?: string | api.TicketScopeParams
  canMutate?: boolean
}) {
  const { ticketId, role, scope, canMutate = true } = props
  const qc = useQueryClient()
  const [draft, setDraft] = useState<MaterialUsageDraft>(EMPTY_MATERIAL_USAGE_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const canAdd = canMutate && canConsumeMaterials(role)

  const usageQ = useQuery({
    queryKey: ['ticket-material-consumptions', ticketId, scope],
    queryFn: () => api.ticketMaterialConsumptions(ticketId, scope),
    enabled: !!ticketId,
  })
  const balancesQ = useQuery({
    queryKey: ['my-material-balances'],
    queryFn: api.myMaterialBalances,
    enabled: canAdd,
  })
  const balances = useMemo(() => selectableBalances(balancesQ.data), [balancesQ.data])

  const consumeM = useMutation({
    mutationFn: async (payload: { materialId: string; quantity: string; comment?: string }) => {
      const linkedClientCompanyId =
        typeof scope === 'object' && scope ? scope.linkedClientCompanyId || undefined : undefined
      return api.consumeTicketMaterial({ ticketId, ...payload, ...(linkedClientCompanyId ? { linkedClientCompanyId } : {}) })
    },
    onSuccess: async () => {
      setDraft(EMPTY_MATERIAL_USAGE_DRAFT)
      setError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ticket-material-consumptions', ticketId] }),
        qc.invalidateQueries({ queryKey: ['my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['my-material-movements'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-history'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-balances'] }),
      ])
    },
    onError: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['my-material-balances'] }),
        qc.invalidateQueries({ queryKey: ['mobile-my-material-balances'] }),
      ])
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateMaterialUsage(draft, balances)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    consumeM.mutate(validation.payload)
  }

  return (
    <section className="materialsPanel">
      <div className="materialsPanelHeader">
        <h3>Материалы</h3>
        <span className="muted small">{usageQ.data?.length ? `Позиций: ${usageQ.data.length}` : 'Пока не списывались'}</span>
      </div>

      {usageQ.isLoading ? <div className="muted small">Загружаем материалы…</div> : null}
      {usageQ.isError ? <div className="alert">{(usageQ.error as Error).message}</div> : null}
      {usageQ.data?.length ? (
        <div className="materialsHistory">
          {usageQ.data.map((item) => (
            <div className="materialsHistoryRow" key={item.id}>
              <div>
                <div className="materialsName">{materialName(item.material)}</div>
                {item.comment ? <div className="muted small">{item.comment}</div> : null}
                {item.fromUser ? <div className="muted small">{materialUserName(item.fromUser)}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="materialsQty">{formatMaterialQuantity(item.quantity, materialUnit(item.material))}</div>
                <div className="muted small">{new Date(item.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <form className="materialsForm" onSubmit={submit}>
          {(error || consumeM.isError || balancesQ.isError) ? (
            <div className="alert">{error || (consumeM.error as Error | null)?.message || (balancesQ.error as Error | null)?.message}</div>
          ) : null}
          <label>
            Материал
            <select
              value={draft.materialId}
              onChange={(e) => setDraft((current) => ({ ...current, materialId: e.target.value }))}
              disabled={consumeM.isPending || balancesQ.isLoading}
            >
              <option value="">Выберите материал</option>
              {balances.map((item) => (
                <option key={item.id} value={item.materialId}>
                  {materialName(item.material)} · {formatMaterialQuantity(item.quantity, materialUnit(item.material))}
                </option>
              ))}
            </select>
          </label>
          <label>
            Количество
            <input
              inputMode="decimal"
              max={maxQuantityFor(draft.materialId, balances)}
              value={draft.quantity}
              onChange={(e) => setDraft((current) => ({ ...current, quantity: e.target.value }))}
              disabled={consumeM.isPending}
            />
          </label>
          <label>
            Комментарий
            <textarea
              rows={2}
              value={draft.comment}
              onChange={(e) => setDraft((current) => ({ ...current, comment: e.target.value }))}
              disabled={consumeM.isPending}
            />
          </label>
          <button type="submit" disabled={consumeM.isPending || balancesQ.isLoading}>
            {consumeM.isPending ? 'Сохраняем…' : '+ Добавить материал'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
