import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import {
  describeMovement,
  formatBalance,
  formatMovementAmount,
  selectableMaterials,
  stockHint,
  validateIssueInput,
} from '../../lib/materials'

/**
 * SMA-MATERIALS-V0 — раздел «Материалы» карточки техника.
 *
 * Показывает остатки техника и историю движений. Если canIssue (смотрит
 * руководитель) — добавляет форму «+ Выдать материал» с подсказкой по
 * складскому остатку COMPANY_STOCK. Недостаток склада ловит backend: UI
 * показывает его ошибку, успех не подделывается.
 *
 * Компонент переиспользуется: в самокабинете техника (canIssue=false) и
 * в списке сотрудников у руководителя (canIssue=true). Своей арифметики нет —
 * формат и валидация берутся из lib/materials.
 */

export function TechnicianMaterials(props: { technicianId: string; canIssue: boolean }) {
  const { technicianId, canIssue } = props
  const qc = useQueryClient()

  const balancesQ = useQuery({
    queryKey: ['technician-material-balances', technicianId],
    queryFn: () => api.technicianMaterialBalances(technicianId),
    enabled: !!technicianId,
  })

  const movementsQ = useQuery({
    queryKey: ['technician-material-movements', technicianId],
    queryFn: () => api.technicianMaterialMovements(technicianId),
    enabled: !!technicianId,
  })

  const balances = useMemo(() => balancesQ.data || [], [balancesQ.data])
  const movements = useMemo(() => movementsQ.data || [], [movementsQ.data])

  return (
    <div className="materialsSection">
      <h3 style={{ marginBottom: 10 }}>Материалы</h3>

      {balancesQ.isError ? (
        <div className="alert">{(balancesQ.error as any)?.message || String(balancesQ.error)}</div>
      ) : null}

      {balancesQ.isFetching && !balancesQ.data ? <div className="muted small">Загрузка остатков…</div> : null}
      {!balancesQ.isFetching && balances.length === 0 ? (
        <div className="muted small">Остатков пока нет</div>
      ) : null}

      {balances.length > 0 ? (
        <ul className="materialsBalanceList">
          {balances.map((b) => (
            <li key={b.materialId} className="materialsBalanceRow">
              {formatBalance(b)}
            </li>
          ))}
        </ul>
      ) : null}

      {canIssue ? <IssueMaterialForm technicianId={technicianId} /> : null}

      <h4 style={{ margin: '14px 0 8px' }}>История</h4>

      {movementsQ.isError ? (
        <div className="alert">{(movementsQ.error as any)?.message || String(movementsQ.error)}</div>
      ) : null}
      {movementsQ.isFetching && !movementsQ.data ? <div className="muted small">Загрузка истории…</div> : null}
      {!movementsQ.isFetching && movements.length === 0 ? (
        <div className="muted small">Движений пока нет</div>
      ) : null}

      {movements.length > 0 ? (
        <ul className="materialsMovementList">
          {movements.map((mv) => {
            const visual = describeMovement(mv)
            return (
              <li key={mv.id} className={`materialsMovementRow materialsMovementRow--${visual.tone}`}>
                <span className="materialsMovementAmount">{formatMovementAmount(mv)}</span>
                <span className="materialsMovementName">{mv.materialName}</span>
                <span className="materialsMovementLabel muted small">{visual.label}</span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <button
        className="ghost"
        onClick={() => {
          void qc.invalidateQueries({ queryKey: ['technician-material-balances', technicianId] })
          void qc.invalidateQueries({ queryKey: ['technician-material-movements', technicianId] })
        }}
        disabled={balancesQ.isFetching || movementsQ.isFetching}
        style={{ marginTop: 10 }}
      >
        Обновить
      </button>
    </div>
  )
}

/** Форма выдачи материала руководителем технику. */
function IssueMaterialForm(props: { technicianId: string }) {
  const { technicianId } = props
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const materialsQ = useQuery({
    queryKey: ['materials', 'active-for-issue'],
    queryFn: () => api.materials(false),
    enabled: open,
  })

  const options = useMemo(() => selectableMaterials(materialsQ.data || []), [materialsQ.data])

  const stockQ = useQuery({
    queryKey: ['material-company-stock', materialId],
    queryFn: () => api.materialCompanyStock(materialId),
    enabled: open && !!materialId,
    retry: false,
  })

  const issueM = useMutation({
    mutationFn: (input: api.IssueMaterialInput) => api.issueMaterialToTechnician(technicianId, input),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Материал выдан')
      setMaterialId('')
      setQuantity('')
      setComment('')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['technician-material-balances', technicianId] }),
        qc.invalidateQueries({ queryKey: ['technician-material-movements', technicianId] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      // Ошибка backend (в т.ч. недостаток COMPANY_STOCK) показывается как есть.
      setErr(e?.message || String(e))
    },
  })

  const requested = Number(quantity)
  const hint = stockHint(stockQ.data, requested)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)

    const input: api.IssueMaterialInput = {
      materialId,
      quantity: requested,
      comment: comment.trim() || null,
    }

    const parsed = validateIssueInput(input)
    if (!parsed.ok) {
      setErr(parsed.error)
      return
    }

    issueM.mutate(input)
  }

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)} style={{ marginTop: 10 }}>
        + Выдать материал
      </button>
    )
  }

  return (
    <div className="panel materialsIssuePanel" style={{ marginTop: 10 }}>
      <h4 style={{ marginBottom: 8 }}>Выдать материал</h4>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="muted small" style={{ marginBottom: 8 }}>{success}</div> : null}

      <form onSubmit={submit} className="form" style={{ gap: 8 }}>
        <label>
          Материал *
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={issueM.isPending}>
            <option value="">— выберите материал —</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        </label>

        <label>
          Количество *
          <input
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            disabled={issueM.isPending}
          />
        </label>

        {materialId && hint.available !== null ? (
          <div className={hint.insufficient ? 'alert' : 'muted small'}>
            На складе компании: {hint.available}
            {hint.insufficient ? ' — меньше запрошенного (подтвердит backend)' : ''}
          </div>
        ) : null}

        <label>
          Комментарий
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="необязательно" disabled={issueM.isPending} />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={issueM.isPending}>
            {issueM.isPending ? 'Выдаём…' : 'Выдать'}
          </button>
          <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={issueM.isPending}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default TechnicianMaterials
